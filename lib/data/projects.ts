import "server-only";
import { getDatabase, type DbClient } from "@/lib/db";
import { mapAsset, mapProject, mapScene } from "@/lib/data/mappers";
import { NotFoundError } from "@/lib/errors";
import type {
  Asset,
  ExportRecord,
  Project,
  ProjectDetail,
  ProjectMode,
  ProjectSummary,
} from "@/lib/types";

const COVER_JOIN = `
  LEFT JOIN LATERAL (
    SELECT a.id, a.storage_path, a.url
    FROM assets a
    WHERE a.owner_id = p.owner_id
      AND a.deleted_at IS NULL
      AND (
        a.id = p.cover_asset_id
        OR (p.cover_asset_id IS NULL AND a.project_id = p.id)
      )
    ORDER BY (a.id = p.cover_asset_id) DESC, a.created_at ASC
    LIMIT 1
  ) cover ON TRUE
`;

function coverUrl(row: Record<string, unknown>): string | null {
  if (row.cover_storage_path) return `/api/media/${String(row.resolved_cover_id)}`;
  return row.cover_url ? String(row.cover_url) : null;
}

function mapSummary(row: Record<string, unknown>): ProjectSummary {
  return {
    ...mapProject(row),
    sceneCount: Number(row.scene_count ?? 0),
    coverUrl: coverUrl(row),
  };
}

export interface ProjectListFilters {
  page: number;
  pageSize: number;
  search: string;
  mode?: ProjectMode;
  favorites?: boolean;
  trash?: boolean;
}

export async function listProjects(
  ownerId: string,
  filters: ProjectListFilters,
): Promise<{ items: ProjectSummary[]; total: number; page: number; pageSize: number }> {
  const db = await getDatabase();
  const conditions = ["p.owner_id = $1"];
  const params: unknown[] = [ownerId];
  if (filters.trash) {
    conditions.push("p.deleted_at IS NOT NULL");
  } else {
    conditions.push("p.deleted_at IS NULL");
  }
  if (filters.mode) {
    params.push(filters.mode);
    conditions.push(`p.mode = $${params.length}`);
  }
  if (filters.favorites) {
    conditions.push("p.favorite = TRUE");
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }
  const where = conditions.join(" AND ");
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countRows] = await Promise.all([
    db.query(
      `SELECT p.*,
         (SELECT COUNT(*)::int FROM scenes s WHERE s.project_id = p.id) AS scene_count,
         cover.id AS resolved_cover_id,
         cover.storage_path AS cover_storage_path,
         cover.url AS cover_url
       FROM projects p
       ${COVER_JOIN}
       WHERE ${where}
       ORDER BY p.updated_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filters.pageSize, offset],
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM projects p WHERE ${where}`, params),
  ]);

  return {
    items: rows.map(mapSummary),
    total: Number(countRows[0]?.total ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getProject(ownerId: string, projectId: string): Promise<ProjectDetail> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT p.*,
       (SELECT COUNT(*)::int FROM scenes s WHERE s.project_id = p.id) AS scene_count,
       cover.id AS resolved_cover_id,
       cover.storage_path AS cover_storage_path,
       cover.url AS cover_url
     FROM projects p
     ${COVER_JOIN}
     WHERE p.owner_id = $1 AND p.id = $2
     LIMIT 1`,
    [ownerId, projectId],
  );
  if (rows.length === 0) throw new NotFoundError("Project not found.");
  const [sceneRows, assetRows] = await Promise.all([
    db.query(`SELECT * FROM scenes WHERE owner_id = $1 AND project_id = $2 ORDER BY order_index ASC, created_at ASC`, [
      ownerId,
      projectId,
    ]),
    db.query(
      `SELECT * FROM assets WHERE owner_id = $1 AND project_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [ownerId, projectId],
    ),
  ]);
  return {
    ...mapSummary(rows[0]),
    scenes: sceneRows.map(mapScene),
    assets: assetRows.map(mapAsset),
  };
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  mode: ProjectMode;
  aspectRatio: string;
  prompt?: string;
  negativePrompt?: string;
  templateSlug?: string | null;
  model?: string | null;
  provider?: string | null;
  settings?: Record<string, unknown>;
  isExample?: boolean;
  scenes?: Array<{ title: string; prompt: string; durationSeconds: number }>;
}

export async function createProject(ownerId: string, input: CreateProjectInput): Promise<ProjectDetail> {
  const db = await getDatabase();
  const id = crypto.randomUUID();
  const settings = {
    ...(input.settings ?? {}),
    ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
  };
  const promptHistory = input.prompt ? [input.prompt] : [];

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO projects
        (id, owner_id, title, description, mode, status, aspect_ratio, provider, model,
         settings, prompt_history, template_slug, is_example)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)`,
      [
        id,
        ownerId,
        input.title,
        input.description ?? "",
        input.mode,
        input.aspectRatio,
        input.provider ?? null,
        input.model ?? null,
        JSON.stringify(settings),
        JSON.stringify(promptHistory),
        input.templateSlug ?? null,
        input.isExample ?? false,
      ],
    );
    const scenes = input.scenes ?? [];
    for (const [index, scene] of scenes.entries()) {
      await tx.query(
        `INSERT INTO scenes
          (id, project_id, owner_id, title, prompt, duration_seconds, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [crypto.randomUUID(), id, ownerId, scene.title, scene.prompt, scene.durationSeconds, index],
      );
    }
  });

  return getProject(ownerId, id);
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  mode?: ProjectMode;
  status?: "draft" | "in_progress" | "complete";
  aspectRatio?: string;
  provider?: string | null;
  model?: string | null;
  settings?: Record<string, unknown>;
  promptHistory?: string[];
  coverAssetId?: string | null;
  favorite?: boolean;
}

export async function updateProject(
  ownerId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };

  if (input.title !== undefined) add("title", input.title);
  if (input.description !== undefined) add("description", input.description);
  if (input.mode !== undefined) add("mode", input.mode);
  if (input.status !== undefined) add("status", input.status);
  if (input.aspectRatio !== undefined) add("aspect_ratio", input.aspectRatio);
  if (input.provider !== undefined) add("provider", input.provider);
  if (input.model !== undefined) add("model", input.model);
  if (input.settings !== undefined) add("settings", JSON.stringify(input.settings), "::jsonb");
  if (input.promptHistory !== undefined)
    add("prompt_history", JSON.stringify(input.promptHistory.slice(0, 100)), "::jsonb");
  if (input.coverAssetId !== undefined) add("cover_asset_id", input.coverAssetId);
  if (input.favorite !== undefined) add("favorite", input.favorite);

  if (sets.length === 0) {
    const current = await getProject(ownerId, projectId);
    return current;
  }
  sets.push("updated_at = NOW()");
  params.push(ownerId, projectId);
  const rows = await db.query(
    `UPDATE projects SET ${sets.join(", ")}
     WHERE owner_id = $${params.length - 1} AND id = $${params.length}
     RETURNING *`,
    params,
  );
  if (rows.length === 0) throw new NotFoundError("Project not found.");
  return mapProject(rows[0]);
}

export async function touchProject(ownerId: string, projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.query(`UPDATE projects SET updated_at = NOW() WHERE owner_id = $1 AND id = $2`, [
    ownerId,
    projectId,
  ]);
}

export async function softDeleteProject(ownerId: string, projectId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.query(
    `UPDATE projects SET deleted_at = NOW(), updated_at = NOW()
     WHERE owner_id = $1 AND id = $2 RETURNING id`,
    [ownerId, projectId],
  );
  if (rows.length === 0) throw new NotFoundError("Project not found.");
}

export async function restoreProject(ownerId: string, projectId: string): Promise<Project> {
  const db = await getDatabase();
  const rows = await db.query(
    `UPDATE projects SET deleted_at = NULL, updated_at = NOW()
     WHERE owner_id = $1 AND id = $2 RETURNING *`,
    [ownerId, projectId],
  );
  if (rows.length === 0) throw new NotFoundError("Project not found.");
  return mapProject(rows[0]);
}

export async function permanentlyDeleteProject(ownerId: string, projectId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.query(`DELETE FROM projects WHERE owner_id = $1 AND id = $2 RETURNING id`, [
    ownerId,
    projectId,
  ]);
  if (rows.length === 0) throw new NotFoundError("Project not found.");
}

async function duplicateInTransaction(
  tx: DbClient,
  ownerId: string,
  projectId: string,
): Promise<string> {
  const projectRows = await tx.query(
    `SELECT * FROM projects WHERE owner_id = $1 AND id = $2 LIMIT 1`,
    [ownerId, projectId],
  );
  if (projectRows.length === 0) throw new NotFoundError("Project not found.");
  const original = projectRows[0];
  const newId = crypto.randomUUID();
  await tx.query(
    `INSERT INTO projects
      (id, owner_id, title, description, mode, status, aspect_ratio, provider, model, settings,
       prompt_history, cover_asset_id, template_slug, is_example, favorite)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,FALSE)`,
    [
      newId,
      ownerId,
      `Copy of ${String(original.title)}`.slice(0, 120),
      original.description,
      original.mode,
      original.aspect_ratio,
      original.provider,
      original.model,
      JSON.stringify(original.settings ?? {}),
      JSON.stringify(original.prompt_history ?? []),
      original.cover_asset_id,
      original.template_slug,
      Boolean(original.is_example),
    ],
  );
  const scenes = await tx.query(
    `SELECT * FROM scenes WHERE owner_id = $1 AND project_id = $2 ORDER BY order_index ASC`,
    [ownerId, projectId],
  );
  for (const [index, scene] of scenes.entries()) {
    await tx.query(
      `INSERT INTO scenes
        (id, project_id, owner_id, title, prompt, negative_prompt, duration_seconds, order_index,
         status, reference_asset_ids, first_frame_asset_id, last_frame_asset_id, transition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9::uuid[],$10,$11,$12)`,
      [
        crypto.randomUUID(),
        newId,
        ownerId,
        scene.title,
        scene.prompt,
        scene.negative_prompt,
        scene.duration_seconds,
        index,
        scene.reference_asset_ids ?? [],
        scene.first_frame_asset_id,
        scene.last_frame_asset_id,
        scene.transition,
      ],
    );
  }
  return newId;
}

export async function duplicateProject(ownerId: string, projectId: string): Promise<ProjectDetail> {
  const db = await getDatabase();
  const newId = await db.transaction((tx) => duplicateInTransaction(tx, ownerId, projectId));
  return getProject(ownerId, newId);
}

export async function exportProject(
  ownerId: string,
  projectId: string,
): Promise<{ record: ExportRecord; project: ProjectDetail }> {
  const db = await getDatabase();
  const project = await getProject(ownerId, projectId);
  const record: ExportRecord = {
    id: crypto.randomUUID(),
    format: "json",
    createdAt: new Date().toISOString(),
    assetCount: project.assets.length,
  };
  const history = [...project.exportHistory, record].slice(-20);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO exports (id, owner_id, project_id, format, metadata)
       VALUES ($1,$2,$3,'json',$4::jsonb)`,
      [record.id, ownerId, projectId, JSON.stringify({ assetCount: record.assetCount })],
    );
    await tx.query(
      `UPDATE projects SET export_history = $1::jsonb, updated_at = NOW()
       WHERE owner_id = $2 AND id = $3`,
      [JSON.stringify(history), ownerId, projectId],
    );
  });
  return { record, project: { ...project, exportHistory: history } };
}

export async function projectAssets(
  ownerId: string,
  projectId: string,
): Promise<Asset[]> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM assets WHERE owner_id = $1 AND project_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [ownerId, projectId],
  );
  return rows.map(mapAsset);
}
