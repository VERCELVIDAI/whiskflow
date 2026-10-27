import "server-only";
import { getDatabase, type DbClient } from "@/lib/db";
import { mapAsset } from "@/lib/data/mappers";
import { NotFoundError } from "@/lib/errors";
import { deleteStoredMedia } from "@/lib/storage";
import type { Asset, AssetKind } from "@/lib/types";

export interface AssetListFilters {
  page: number;
  pageSize: number;
  search: string;
  kind?: AssetKind;
  folder?: string;
  favorites?: boolean;
  trash?: boolean;
  projectId?: string;
  sort: "newest" | "oldest" | "title";
}

export async function listAssets(
  ownerId: string,
  filters: AssetListFilters,
): Promise<{ items: Asset[]; total: number; page: number; pageSize: number }> {
  const db = await getDatabase();
  const conditions = ["owner_id = $1"];
  const params: unknown[] = [ownerId];
  if (filters.trash) conditions.push("deleted_at IS NOT NULL");
  else conditions.push("deleted_at IS NULL");
  if (filters.kind) {
    params.push(filters.kind);
    conditions.push(`kind = $${params.length}`);
  }
  if (filters.folder) {
    params.push(filters.folder);
    conditions.push(`folder = $${params.length}`);
  }
  if (filters.favorites) conditions.push("favorite = TRUE");
  if (filters.projectId) {
    params.push(filters.projectId);
    conditions.push(`project_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(title ILIKE $${params.length} OR COALESCE(prompt, '') ILIKE $${params.length} OR COALESCE(folder, '') ILIKE $${params.length})`,
    );
  }
  const where = conditions.join(" AND ");
  const order =
    filters.sort === "oldest"
      ? "created_at ASC"
      : filters.sort === "title"
        ? "title ASC"
        : "created_at DESC";
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countRows] = await Promise.all([
    db.query(
      `SELECT * FROM assets WHERE ${where} ORDER BY ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filters.pageSize, offset],
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM assets WHERE ${where}`, params),
  ]);
  return {
    items: rows.map(mapAsset),
    total: Number(countRows[0]?.total ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function listAssetFolders(
  ownerId: string,
): Promise<Array<{ folder: string; count: number }>> {
  const db = await getDatabase();
  const rows = await db.query<{ folder: string; count: number }>(
    `SELECT folder, COUNT(*)::int AS count FROM assets
     WHERE owner_id = $1 AND deleted_at IS NULL
     GROUP BY folder ORDER BY folder ASC`,
    [ownerId],
  );
  return rows.map((row) => ({ folder: String(row.folder), count: Number(row.count) }));
}

export async function getAsset(ownerId: string, assetId: string): Promise<Asset> {
  const db = await getDatabase();
  const rows = await db.query(`SELECT * FROM assets WHERE owner_id = $1 AND id = $2 LIMIT 1`, [
    ownerId,
    assetId,
  ]);
  if (rows.length === 0) throw new NotFoundError("Asset not found.");
  return mapAsset(rows[0]);
}

export async function getAssetsByIds(ownerId: string, assetIds: string[]): Promise<Asset[]> {
  if (assetIds.length === 0) return [];
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM assets WHERE owner_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
    [ownerId, assetIds],
  );
  return rows.map(mapAsset);
}

export interface CreateAssetInput {
  id?: string;
  projectId?: string | null;
  sceneId?: string | null;
  kind: AssetKind;
  title: string;
  url?: string | null;
  thumbnailUrl?: string | null;
  storageProvider: "local" | "supabase";
  storagePath?: string | null;
  mimeType: string;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  provider?: string | null;
  model?: string | null;
  aspectRatio?: string | null;
  source?: "upload" | "generation" | "example";
  folder?: string;
  tags?: string[];
  favorite?: boolean;
  metadata?: Record<string, unknown>;
  isExample?: boolean;
}

export async function insertAssetTx(
  tx: DbClient,
  ownerId: string,
  input: CreateAssetInput,
): Promise<Asset> {
  const id = input.id ?? crypto.randomUUID();
  const rows = await tx.query(
    `INSERT INTO assets
      (id, owner_id, project_id, scene_id, kind, title, url, thumbnail_url, storage_provider,
       storage_path, mime_type, size_bytes, width, height, duration_seconds, prompt, negative_prompt,
       provider, model, aspect_ratio, source, folder, tags, favorite, metadata, is_example)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::text[],$24,$25::jsonb,$26)
     RETURNING *`,
    [
      id,
      ownerId,
      input.projectId ?? null,
      input.sceneId ?? null,
      input.kind,
      input.title.slice(0, 180),
      input.url ?? null,
      input.thumbnailUrl ?? null,
      input.storageProvider,
      input.storagePath ?? null,
      input.mimeType,
      input.sizeBytes ?? 0,
      input.width ?? null,
      input.height ?? null,
      input.durationSeconds ?? null,
      input.prompt ?? null,
      input.negativePrompt ?? null,
      input.provider ?? null,
      input.model ?? null,
      input.aspectRatio ?? null,
      input.source ?? "upload",
      input.folder ?? "Unsorted",
      input.tags ?? [],
      input.favorite ?? false,
      JSON.stringify(input.metadata ?? {}),
      input.isExample ?? false,
    ],
  );
  return mapAsset(rows[0]);
}

export async function createAsset(ownerId: string, input: CreateAssetInput): Promise<Asset> {
  const db = await getDatabase();
  return insertAssetTx(db, ownerId, input);
}

export interface UpdateAssetInput {
  title?: string;
  favorite?: boolean;
  folder?: string;
  tags?: string[];
  projectId?: string | null;
  sceneId?: string | null;
}

export async function updateAsset(
  ownerId: string,
  assetId: string,
  input: UpdateAssetInput,
): Promise<Asset> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };
  if (input.title !== undefined) add("title", input.title);
  if (input.favorite !== undefined) add("favorite", input.favorite);
  if (input.folder !== undefined) add("folder", input.folder);
  if (input.tags !== undefined) add("tags", input.tags, "::text[]");
  if (input.projectId !== undefined) add("project_id", input.projectId);
  if (input.sceneId !== undefined) add("scene_id", input.sceneId);
  if (sets.length === 0) return getAsset(ownerId, assetId);
  sets.push("updated_at = NOW()");
  params.push(ownerId, assetId);
  const rows = await db.query(
    `UPDATE assets SET ${sets.join(", ")}
     WHERE owner_id = $${params.length - 1} AND id = $${params.length}
     RETURNING *`,
    params,
  );
  if (rows.length === 0) throw new NotFoundError("Asset not found.");
  return mapAsset(rows[0]);
}

export async function softDeleteAsset(ownerId: string, assetId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.query(
    `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
     WHERE owner_id = $1 AND id = $2 RETURNING id`,
    [ownerId, assetId],
  );
  if (rows.length === 0) throw new NotFoundError("Asset not found.");
}

export async function restoreAsset(ownerId: string, assetId: string): Promise<Asset> {
  const db = await getDatabase();
  const rows = await db.query(
    `UPDATE assets SET deleted_at = NULL, updated_at = NOW()
     WHERE owner_id = $1 AND id = $2 RETURNING *`,
    [ownerId, assetId],
  );
  if (rows.length === 0) throw new NotFoundError("Asset not found.");
  return mapAsset(rows[0]);
}

export async function permanentlyDeleteAsset(ownerId: string, assetId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.query(
    `DELETE FROM assets WHERE owner_id = $1 AND id = $2 RETURNING storage_path`,
    [ownerId, assetId],
  );
  if (rows.length === 0) throw new NotFoundError("Asset not found.");
  const storagePath = rows[0].storage_path;
  if (storagePath) {
    try {
      await deleteStoredMedia(String(storagePath));
    } catch {
      // The database record is already gone; orphaned media is cleaned separately.
    }
  }
}
