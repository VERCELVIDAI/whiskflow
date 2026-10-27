import "server-only";
import { getDatabase, type DbClient } from "@/lib/db";
import { mapScene } from "@/lib/data/mappers";
import { NotFoundError } from "@/lib/errors";
import type { Scene } from "@/lib/types";

async function requireProject(tx: DbClient, ownerId: string, projectId: string): Promise<void> {
  const rows = await tx.query(
    `SELECT id FROM projects WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1`,
    [ownerId, projectId],
  );
  if (rows.length === 0) throw new NotFoundError("Project not found.");
}

export async function createScene(
  ownerId: string,
  projectId: string,
  input: {
    title: string;
    prompt: string;
    negativePrompt: string;
    durationSeconds: number;
    transition: Scene["transition"];
    referenceAssetIds: string[];
  },
): Promise<Scene> {
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    await requireProject(tx, ownerId, projectId);
    const orderRows = await tx.query<{ next_index: number }>(
      `SELECT COALESCE(MAX(order_index) + 1, 0)::int AS next_index FROM scenes WHERE project_id = $1`,
      [projectId],
    );
    const orderIndex = Number(orderRows[0]?.next_index ?? 0);
    const id = crypto.randomUUID();
    const rows = await tx.query(
      `INSERT INTO scenes
        (id, project_id, owner_id, title, prompt, negative_prompt, duration_seconds, order_index,
         transition, reference_asset_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid[])
       RETURNING *`,
      [
        id,
        projectId,
        ownerId,
        input.title,
        input.prompt,
        input.negativePrompt,
        input.durationSeconds,
        orderIndex,
        input.transition,
        input.referenceAssetIds,
      ],
    );
    await tx.query(`UPDATE projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [
      projectId,
    ]);
    return mapScene(rows[0]);
  });
}

export interface UpdateSceneInput {
  title?: string;
  prompt?: string;
  negativePrompt?: string;
  durationSeconds?: number;
  transition?: Scene["transition"];
  referenceAssetIds?: string[];
  firstFrameAssetId?: string | null;
  lastFrameAssetId?: string | null;
  thumbnailUrl?: string | null;
  videoAssetId?: string | null;
  generationJobId?: string | null;
  status?: Scene["status"];
  error?: string | null;
  orderIndex?: number;
}

export async function updateScene(
  ownerId: string,
  sceneId: string,
  input: UpdateSceneInput,
): Promise<Scene> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };
  if (input.title !== undefined) add("title", input.title);
  if (input.prompt !== undefined) add("prompt", input.prompt);
  if (input.negativePrompt !== undefined) add("negative_prompt", input.negativePrompt);
  if (input.durationSeconds !== undefined) add("duration_seconds", input.durationSeconds);
  if (input.transition !== undefined) add("transition", input.transition);
  if (input.referenceAssetIds !== undefined)
    add("reference_asset_ids", input.referenceAssetIds, "::uuid[]");
  if (input.firstFrameAssetId !== undefined) add("first_frame_asset_id", input.firstFrameAssetId);
  if (input.lastFrameAssetId !== undefined) add("last_frame_asset_id", input.lastFrameAssetId);
  if (input.thumbnailUrl !== undefined) add("thumbnail_url", input.thumbnailUrl);
  if (input.videoAssetId !== undefined) add("video_asset_id", input.videoAssetId);
  if (input.generationJobId !== undefined) add("generation_job_id", input.generationJobId);
  if (input.status !== undefined) add("status", input.status);
  if (input.error !== undefined) add("error", input.error);
  if (input.orderIndex !== undefined) add("order_index", input.orderIndex);

  if (sets.length === 0) {
    const rows = await db.query(`SELECT * FROM scenes WHERE owner_id = $1 AND id = $2`, [
      ownerId,
      sceneId,
    ]);
    if (rows.length === 0) throw new NotFoundError("Scene not found.");
    return mapScene(rows[0]);
  }
  sets.push("updated_at = NOW()");
  params.push(ownerId, sceneId);
  const rows = await db.query(
    `UPDATE scenes SET ${sets.join(", ")}
     WHERE owner_id = $${params.length - 1} AND id = $${params.length}
     RETURNING *`,
    params,
  );
  if (rows.length === 0) throw new NotFoundError("Scene not found.");
  const scene = mapScene(rows[0]);
  await db.query(`UPDATE projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [
    scene.projectId,
  ]);
  return scene;
}

export async function deleteScene(ownerId: string, sceneId: string): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const rows = await tx.query<{ project_id: string }>(
      `DELETE FROM scenes WHERE owner_id = $1 AND id = $2 RETURNING project_id`,
      [ownerId, sceneId],
    );
    if (rows.length === 0) throw new NotFoundError("Scene not found.");
    const projectId = String(rows[0].project_id);
    const remaining = await tx.query<{ id: string }>(
      `SELECT id FROM scenes WHERE project_id = $1 ORDER BY order_index ASC, created_at ASC`,
      [projectId],
    );
    for (const [index, row] of remaining.entries()) {
      await tx.query(`UPDATE scenes SET order_index = $1 WHERE id = $2`, [index, row.id]);
    }
    await tx.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
  });
}

export async function reorderScenes(
  ownerId: string,
  projectId: string,
  sceneIds: string[],
): Promise<Scene[]> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    await requireProject(tx, ownerId, projectId);
    const rows = await tx.query<{ id: string }>(
      `SELECT id FROM scenes WHERE owner_id = $1 AND project_id = $2`,
      [ownerId, projectId],
    );
    const existing = new Set(rows.map((row) => String(row.id)));
    if (existing.size !== sceneIds.length || sceneIds.some((id) => !existing.has(id))) {
      throw new NotFoundError("One or more scenes no longer exist. Refresh and try again.");
    }
    for (const [index, sceneId] of sceneIds.entries()) {
      await tx.query(
        `UPDATE scenes SET order_index = $1, updated_at = NOW()
         WHERE owner_id = $2 AND project_id = $3 AND id = $4`,
        [index, ownerId, projectId, sceneId],
      );
    }
    await tx.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
  });
  const scenes = await db.query(
    `SELECT * FROM scenes WHERE owner_id = $1 AND project_id = $2 ORDER BY order_index ASC`,
    [ownerId, projectId],
  );
  return scenes.map(mapScene);
}

export async function duplicateScene(ownerId: string, sceneId: string): Promise<Scene> {
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const rows = await tx.query(`SELECT * FROM scenes WHERE owner_id = $1 AND id = $2 LIMIT 1`, [
      ownerId,
      sceneId,
    ]);
    if (rows.length === 0) throw new NotFoundError("Scene not found.");
    const original = rows[0];
    const projectId = String(original.project_id);
    const orderIndex = Number(original.order_index);
    await tx.query(
      `UPDATE scenes SET order_index = order_index + 1
       WHERE project_id = $1 AND order_index > $2`,
      [projectId, orderIndex],
    );
    const newRows = await tx.query(
      `INSERT INTO scenes
        (id, project_id, owner_id, title, prompt, negative_prompt, duration_seconds, order_index,
         status, reference_asset_ids, first_frame_asset_id, last_frame_asset_id, transition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9::uuid[],$10,$11,$12)
       RETURNING *`,
      [
        crypto.randomUUID(),
        projectId,
        ownerId,
        `${String(original.title)} copy`.slice(0, 120),
        original.prompt,
        original.negative_prompt,
        original.duration_seconds,
        orderIndex + 1,
        original.reference_asset_ids ?? [],
        original.first_frame_asset_id,
        original.last_frame_asset_id,
        original.transition,
      ],
    );
    await tx.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
    return mapScene(newRows[0]);
  });
}

export async function getScene(ownerId: string, sceneId: string): Promise<Scene> {
  const db = await getDatabase();
  const rows = await db.query(`SELECT * FROM scenes WHERE owner_id = $1 AND id = $2 LIMIT 1`, [
    ownerId,
    sceneId,
  ]);
  if (rows.length === 0) throw new NotFoundError("Scene not found.");
  return mapScene(rows[0]);
}

export async function attachSceneResult(
  ownerId: string,
  sceneId: string,
  result: { videoAssetId: string; thumbnailUrl: string | null; generationJobId: string },
): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const rows = await tx.query<{ project_id: string }>(
      `UPDATE scenes
       SET status = 'ready', video_asset_id = $1, thumbnail_url = $2,
           generation_job_id = $3, error = NULL, updated_at = NOW()
       WHERE owner_id = $4 AND id = $5
       RETURNING project_id`,
      [result.videoAssetId, result.thumbnailUrl, result.generationJobId, ownerId, sceneId],
    );
    if (rows.length > 0) {
      await tx.query(`UPDATE projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [
        rows[0].project_id,
      ]);
    }
  });
}

export async function markSceneFailed(ownerId: string, sceneId: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.query(
    `UPDATE scenes SET status = 'failed', error = $1, updated_at = NOW()
     WHERE owner_id = $2 AND id = $3`,
    [error.slice(0, 1000), ownerId, sceneId],
  );
}
