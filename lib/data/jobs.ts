import "server-only";
import { getDatabase, type DbClient } from "@/lib/db";
import { mapAsset, mapJob } from "@/lib/data/mappers";
import { NotFoundError } from "@/lib/errors";
import type { Asset, GenerationJob, GenerationSettings } from "@/lib/types";

export interface CreateJobInput {
  id: string;
  ownerId: string;
  projectId: string | null;
  sceneId: string | null;
  kind: "image" | "video";
  provider: string;
  model: string;
  prompt: string;
  negativePrompt: string;
  settings: GenerationSettings;
  outputCount: number;
  creditsReserved: number;
  idempotencyKey: string;
  status?: GenerationJob["status"];
}

export async function insertJobTx(tx: DbClient, input: CreateJobInput): Promise<GenerationJob> {
  const rows = await tx.query(
    `INSERT INTO generation_jobs
      (id, owner_id, project_id, scene_id, kind, provider, model, status, prompt, negative_prompt,
       settings, output_count, credits_reserved, idempotency_key, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
     RETURNING *`,
    [
      input.id,
      input.ownerId,
      input.projectId,
      input.sceneId,
      input.kind,
      input.provider,
      input.model,
      input.status ?? "queued",
      input.prompt,
      input.negativePrompt,
      JSON.stringify(input.settings),
      input.outputCount,
      input.creditsReserved,
      input.idempotencyKey,
      input.status === "running" ? new Date() : null,
    ],
  );
  return mapJob(rows[0]);
}

export async function getJob(ownerId: string, jobId: string): Promise<GenerationJob> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM generation_jobs WHERE owner_id = $1 AND id = $2 LIMIT 1`,
    [ownerId, jobId],
  );
  if (rows.length === 0) throw new NotFoundError("Generation not found.");
  return mapJob(rows[0]);
}

export async function getJobWithAssets(
  ownerId: string,
  jobId: string,
): Promise<{ job: GenerationJob; assets: Asset[] }> {
  const job = await getJob(ownerId, jobId);
  if (job.assetIds.length === 0) return { job, assets: [] };
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM assets WHERE owner_id = $1 AND id = ANY($2::uuid[]) ORDER BY created_at ASC`,
    [ownerId, job.assetIds],
  );
  return { job, assets: rows.map(mapAsset) };
}

export async function listJobs(ownerId: string, limit = 20): Promise<GenerationJob[]> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM generation_jobs WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [ownerId, Math.min(Math.max(limit, 1), 100)],
  );
  return rows.map(mapJob);
}

export async function getJobByIdempotencyKey(
  ownerId: string,
  idempotencyKey: string,
): Promise<GenerationJob | null> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM generation_jobs WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [ownerId, idempotencyKey],
  );
  return rows.length > 0 ? mapJob(rows[0]) : null;
}

export async function updateJob(
  ownerId: string,
  jobId: string,
  input: {
    status?: GenerationJob["status"];
    providerJobId?: string | null;
    resultAssetId?: string | null;
    assetIds?: string[];
    error?: string | null;
    attempts?: number;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): Promise<GenerationJob> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };
  if (input.status !== undefined) add("status", input.status);
  if (input.providerJobId !== undefined) add("provider_job_id", input.providerJobId);
  if (input.resultAssetId !== undefined) add("result_asset_id", input.resultAssetId);
  if (input.assetIds !== undefined) add("asset_ids", JSON.stringify(input.assetIds), "::jsonb");
  if (input.error !== undefined) add("error", input.error);
  if (input.attempts !== undefined) add("attempts", input.attempts);
  if (input.startedAt !== undefined) add("started_at", input.startedAt);
  if (input.completedAt !== undefined) add("completed_at", input.completedAt);
  sets.push("updated_at = NOW()");
  params.push(ownerId, jobId);
  const rows = await db.query(
    `UPDATE generation_jobs SET ${sets.join(", ")}
     WHERE owner_id = $${params.length - 1} AND id = $${params.length}
     RETURNING *`,
    params,
  );
  if (rows.length === 0) throw new NotFoundError("Generation not found.");
  return mapJob(rows[0]);
}
