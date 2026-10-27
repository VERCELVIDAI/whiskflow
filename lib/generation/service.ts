import "server-only";
import { getDatabase, isUniqueViolation } from "@/lib/db";
import { AppError, ProviderError } from "@/lib/errors";
import { logWarning } from "@/lib/errors";
import { getProviderAdapter } from "@/lib/providers";
import {
  estimateCredits,
  getGenerationModelForKind,
  getProviderCatalog,
  isProviderConfigured,
  providerEnvVariable,
  type InternalModel,
  type ProviderName,
} from "@/lib/providers/models";
import { getAssetsByIds, insertAssetTx, type CreateAssetInput } from "@/lib/data/assets";
import { getProject, updateProject } from "@/lib/data/projects";
import { getScene } from "@/lib/data/scenes";
import { getJob, getJobByIdempotencyKey, getJobWithAssets, insertJobTx, updateJob } from "@/lib/data/jobs";
import { captureCreditsTx, releaseCreditsTx, reserveCreditsTx } from "@/lib/data/credits";
import { readAssetData, putMedia } from "@/lib/storage";
import type { GenerationJob, GenerationSettings } from "@/lib/types";
import type {
  ProviderGenerationRequest,
  ProviderInputImage,
  ProviderOutputAsset,
} from "@/lib/providers/types";

export interface GenerationRequestInput {
  kind: "image" | "video";
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  durationSeconds?: number;
  resolution?: string;
  outputCount?: number;
  quality?: "low" | "medium" | "high";
  stylePreset?: string;
  seed?: number | null;
  generateAudio?: boolean;
  projectId?: string | null;
  sceneId?: string | null;
  referenceAssetIds?: string[];
  firstFrameAssetId?: string | null;
  lastFrameAssetId?: string | null;
  idempotencyKey?: string;
}

function normalizeModelRequest(
  model: InternalModel,
  input: GenerationRequestInput,
): {
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  outputCount: number;
  negativePrompt: string;
  generateAudio: boolean;
} {
  if (!model.aspectRatios.includes(input.aspectRatio)) {
    throw new AppError(
      422,
      "invalid_setting",
      `${model.label} supports ${model.aspectRatios.join(", ")} aspect ratios.`,
    );
  }
  const resolution = input.resolution || model.resolutions[0] || "Auto";
  if (!model.resolutions.includes(resolution)) {
    throw new AppError(
      422,
      "invalid_setting",
      `${model.label} supports ${model.resolutions.join(", ")} resolution.`,
    );
  }
  // Video models currently expose a provider-fixed duration. Project and scene
  // defaults may carry a different value, so normalize instead of rejecting.
  const durationSeconds = model.kind === "video" ? model.durations[0] || 10 : 0;
  const outputCount = Math.max(1, Math.min(input.outputCount ?? 1, model.maxOutputs));
  if (input.negativePrompt && !model.supportsNegativePrompt) {
    // The capability is advertised honestly. Silently ignore unsupported controls.
  }
  return {
    aspectRatio: input.aspectRatio,
    resolution,
    durationSeconds,
    outputCount,
    negativePrompt: model.supportsNegativePrompt ? input.negativePrompt ?? "" : "",
    generateAudio: model.supportsAudio ? Boolean(input.generateAudio) : false,
  };
}

async function prepareImages(
  ownerId: string,
  model: InternalModel,
  input: GenerationRequestInput,
): Promise<ProviderInputImage[]> {
  const referenceIds = input.referenceAssetIds ?? [];
  if (referenceIds.length > 0 && !model.supportsReferences) {
    throw new AppError(422, "unsupported_reference", `${model.label} does not accept reference images.`);
  }
  if (input.firstFrameAssetId && !model.supportsFirstFrame) {
    throw new AppError(422, "unsupported_frame", `${model.label} does not accept a first frame.`);
  }
  if (input.lastFrameAssetId && !model.supportsLastFrame) {
    throw new AppError(422, "unsupported_frame", `${model.label} does not accept a last frame.`);
  }
  const allIds = [
    ...(input.firstFrameAssetId ? [input.firstFrameAssetId] : []),
    ...(input.lastFrameAssetId ? [input.lastFrameAssetId] : []),
    ...referenceIds,
  ];
  if (allIds.length === 0) return [];
  const assets = await getAssetsByIds(ownerId, allIds);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  if (assets.length !== new Set(allIds).size) {
    throw new AppError(422, "invalid_reference", "One or more reference images are unavailable.");
  }

  const result: ProviderInputImage[] = [];
  const add = async (id: string, role: ProviderInputImage["role"]) => {
    const asset = byId.get(id);
    if (!asset) throw new AppError(422, "invalid_reference", "A reference image is unavailable.");
    if (!asset.mimeType.startsWith("image/")) {
      throw new AppError(422, "invalid_reference", "References must be image files.");
    }
    const data = await readAssetData(asset);
    result.push({ data: data.data, mimeType: data.mimeType || asset.mimeType, role });
  };
  if (input.firstFrameAssetId) await add(input.firstFrameAssetId, "first-frame");
  if (input.lastFrameAssetId) await add(input.lastFrameAssetId, "last-frame");
  for (const id of referenceIds) await add(id, "reference");
  return result;
}

async function dimensions(data: Buffer, mimeType: string): Promise<{ width: number | null; height: number | null }> {
  if (!mimeType.startsWith("image/")) return { width: null, height: null };
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(data).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

async function storeProviderAssets(
  ownerId: string,
  input: GenerationRequestInput,
  model: InternalModel,
  jobId: string,
  sceneId: string | null,
  projectId: string | null,
  outputs: ProviderOutputAsset[],
  settings: GenerationSettings,
): Promise<CreateAssetInput[]> {
  const prepared: CreateAssetInput[] = [];
  for (const [index, output] of outputs.entries()) {
    const id = crypto.randomUUID();
    const stored = await putMedia({
      ownerId,
      data: output.data,
      mimeType: output.mimeType,
      mediaId: id,
    });
    const size = await dimensions(output.data, output.mimeType);
    prepared.push({
      id,
      projectId,
      sceneId,
      kind: model.kind,
      title: input.prompt.slice(0, 90) || `${model.label} generation`,
      storageProvider: stored.provider,
      storagePath: stored.storagePath,
      mimeType: output.mimeType,
      sizeBytes: stored.sizeBytes,
      width: output.width ?? size.width,
      height: output.height ?? size.height,
      durationSeconds: output.durationSeconds ?? (model.kind === "video" ? settings.durationSeconds : null),
      prompt: input.prompt,
      negativePrompt: settings.negativePrompt ?? "",
      provider: model.provider,
      model: model.id,
      aspectRatio: settings.aspectRatio,
      source: "generation",
      folder: "Generations",
      tags: [model.label],
      metadata: { jobId, outputIndex: index },
    });
  }
  return prepared;
}

async function completeJob(
  ownerId: string,
  job: GenerationJob,
  prepared: CreateAssetInput[],
  providerJobId?: string | null,
): Promise<{ job: GenerationJob; assets: Awaited<ReturnType<typeof getJobWithAssets>>["assets"] }> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT * FROM generation_jobs WHERE owner_id = $1 AND id = $2 FOR UPDATE`,
      [ownerId, job.id],
    );
    if (rows.length === 0) throw new AppError(404, "not_found", "Generation not found.");
    if (String(rows[0].status) === "succeeded") return;

    const assets = [];
    for (const asset of prepared) {
      assets.push(await insertAssetTx(tx, ownerId, asset));
    }
    const first = assets[0];
    await tx.query(
      `UPDATE generation_jobs
       SET status = 'succeeded', provider_job_id = COALESCE($1, provider_job_id),
           asset_ids = $2::jsonb, result_asset_id = $3, error = NULL,
           completed_at = NOW(), updated_at = NOW()
       WHERE owner_id = $4 AND id = $5`,
      [
        providerJobId ?? null,
        JSON.stringify(assets.map((asset) => asset.id)),
        first?.id ?? null,
        ownerId,
        job.id,
      ],
    );
    if (job.creditsReserved > 0) {
      await captureCreditsTx(tx, {
        ownerId,
        amount: job.creditsReserved,
        generationId: job.id,
        description: `${job.kind === "video" ? "Video" : "Image"} generation · ${job.model}`,
      });
    }
    if (job.sceneId && first) {
      if (job.kind === "video") {
        await tx.query(
          `UPDATE scenes SET status = 'ready', video_asset_id = $1, generation_job_id = $2,
             error = NULL, updated_at = NOW()
           WHERE owner_id = $3 AND id = $4`,
          [first.id, job.id, ownerId, job.sceneId],
        );
      } else {
        await tx.query(
          `UPDATE scenes SET status = 'ready', thumbnail_url = $1, generation_job_id = $2,
             error = NULL, updated_at = NOW()
           WHERE owner_id = $3 AND id = $4`,
          [`/api/media/${first.id}`, job.id, ownerId, job.sceneId],
        );
      }
    }
    if (job.projectId) {
      await tx.query(
        `UPDATE projects
         SET status = 'in_progress',
             cover_asset_id = COALESCE(cover_asset_id, $1),
             updated_at = NOW()
         WHERE owner_id = $2 AND id = $3`,
        [first?.id ?? null, ownerId, job.projectId],
      );
    }
  });
  return getJobWithAssets(ownerId, job.id);
}

async function failJob(
  ownerId: string,
  job: GenerationJob,
  error: string,
  status: "failed" | "cancelled" = "failed",
): Promise<GenerationJob> {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT * FROM generation_jobs WHERE owner_id = $1 AND id = $2 FOR UPDATE`,
      [ownerId, job.id],
    );
    if (rows.length === 0) return;
    const current = String(rows[0].status);
    if (current === "succeeded" || current === "failed" || current === "cancelled") return;
    await releaseCreditsTx(tx, {
      ownerId,
      amount: job.creditsReserved,
      generationId: job.id,
      description: `${status === "cancelled" ? "Cancelled" : "Failed"} generation · ${job.model}`,
    });
    await tx.query(
      `UPDATE generation_jobs
       SET status = $1, error = $2, completed_at = NOW(), updated_at = NOW()
       WHERE owner_id = $3 AND id = $4`,
      [status, error.slice(0, 1000), ownerId, job.id],
    );
    if (job.sceneId) {
      await tx.query(
        `UPDATE scenes SET status = $1, error = $2, updated_at = NOW()
         WHERE owner_id = $3 AND id = $4`,
        [status === "cancelled" ? "draft" : "failed", error.slice(0, 1000), ownerId, job.sceneId],
      );
    }
  });
  return getJob(ownerId, job.id);
}

export async function startGeneration(
  ownerId: string,
  input: GenerationRequestInput,
): Promise<{ job: GenerationJob; assets: Awaited<ReturnType<typeof getJobWithAssets>>["assets"] }> {
  let model: InternalModel;
  try {
    model = getGenerationModelForKind(input.model, input.kind);
  } catch (error) {
    throw new AppError(
      422,
      "invalid_model",
      error instanceof Error ? error.message : "Choose a valid generation model.",
    );
  }
  if (!isProviderConfigured(model.provider)) {
    throw new AppError(
      503,
      "provider_not_configured",
      `${model.providerLabel} is not connected. Add ${providerEnvVariable(model.provider)} on the server to generate.`,
    );
  }
  const normalized = normalizeModelRequest(model, input);
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();

  const existing = await getJobByIdempotencyKey(ownerId, idempotencyKey);
  if (existing) return getJobWithAssets(ownerId, existing.id);

  let projectId = input.projectId ?? null;
  if (input.sceneId) {
    const scene = await getScene(ownerId, input.sceneId);
    if (projectId && scene.projectId !== projectId) {
      throw new AppError(422, "invalid_scene", "The scene does not belong to this project.");
    }
    projectId = scene.projectId;
  }
  if (projectId) {
    await getProject(ownerId, projectId);
  }

  const images = await prepareImages(ownerId, model, input);
  const credits = estimateCredits(model, {
    durationSeconds: normalized.durationSeconds,
    outputCount: normalized.outputCount,
  });
  const settings: GenerationSettings = {
    aspectRatio: normalized.aspectRatio,
    resolution: normalized.resolution,
    durationSeconds: normalized.durationSeconds || undefined,
    generateAudio: normalized.generateAudio,
    seed: input.seed ?? null,
    quality: input.quality,
    stylePreset: input.stylePreset,
    negativePrompt: normalized.negativePrompt,
    referenceAssetIds: input.referenceAssetIds ?? [],
    firstFrameAssetId: input.firstFrameAssetId ?? null,
    lastFrameAssetId: input.lastFrameAssetId ?? null,
  };

  const jobId = crypto.randomUUID();
  let job: GenerationJob;
  try {
    job = await (async () => {
      const db = await getDatabase();
      const holder: { job?: GenerationJob } = {};
      await db.transaction(async (tx) => {
        // The credit ledger references generation_jobs, so the job must exist
        // before the reservation row is inserted. Both writes are atomic.
        holder.job = await insertJobTx(tx, {
          id: jobId,
          ownerId,
          projectId,
          sceneId: input.sceneId ?? null,
          kind: input.kind,
          provider: model.provider,
          model: model.id,
          prompt: input.prompt,
          negativePrompt: normalized.negativePrompt,
          settings,
          outputCount: normalized.outputCount,
          creditsReserved: credits,
          idempotencyKey,
          status: "running",
        });
        await reserveCreditsTx(tx, {
          ownerId,
          amount: credits,
          generationId: jobId,
          description: `Reserved credits · ${model.label}`,
        });
      });
      if (!holder.job) throw new AppError(500, "job_create_failed", "Could not start generation.");
      return holder.job;
    })();
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await getJobByIdempotencyKey(ownerId, idempotencyKey);
      if (raced) return getJobWithAssets(ownerId, raced.id);
    }
    throw error;
  }

  if (projectId) {
    try {
      const project = await getProject(ownerId, projectId);
      await updateProject(ownerId, projectId, {
        status: "in_progress",
        provider: model.provider,
        model: model.id,
        promptHistory: [...project.promptHistory, input.prompt].slice(-100),
      });
    } catch (error) {
      logWarning("Could not update project prompt history", {
        projectId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (input.sceneId) {
    const db = await getDatabase();
    await db.query(
      `UPDATE scenes SET status = 'generating', generation_job_id = $1, error = NULL, updated_at = NOW()
       WHERE owner_id = $2 AND id = $3`,
      [jobId, ownerId, input.sceneId],
    );
  }

  const providerRequest: ProviderGenerationRequest = {
    model,
    prompt: input.prompt,
    negativePrompt: normalized.negativePrompt,
    aspectRatio: normalized.aspectRatio,
    resolution: normalized.resolution,
    durationSeconds: normalized.durationSeconds || undefined,
    outputCount: normalized.outputCount,
    quality: input.quality,
    seed: input.seed,
    generateAudio: normalized.generateAudio,
    images,
  };

  try {
    const adapter = getProviderAdapter(model.provider);
    const result = await adapter.create(providerRequest);
    if (result.status === "failed") {
      const failed = await failJob(ownerId, job, result.error);
      throw new ProviderError(model.provider, failed.error || result.error);
    }
    if (result.status === "running") {
      job = await updateJob(ownerId, job.id, {
        status: "running",
        providerJobId: result.providerJobId,
        startedAt: new Date().toISOString(),
      });
      return { job, assets: [] };
    }
    const prepared = await storeProviderAssets(
      ownerId,
      input,
      model,
      job.id,
      input.sceneId ?? null,
      projectId,
      result.assets,
      settings,
    );
    return completeJob(ownerId, job, prepared, result.providerJobId ?? null);
  } catch (error) {
    if (error instanceof ProviderError) {
      try {
        await failJob(ownerId, job, error.message);
      } catch (failError) {
        logWarning("Could not finalize failed generation", {
          jobId: job.id,
          message: failError instanceof Error ? failError.message : String(failError),
        });
      }
      throw error;
    }
    if (error instanceof AppError) throw error;
    const safeMessage =
      error instanceof Error && /abort|timeout/i.test(error.message)
        ? "The provider took too long to respond. Your reserved credits were released."
        : "The generation could not be completed. Your reserved credits were released.";
    try {
      await failJob(ownerId, job, safeMessage);
    } catch (failError) {
      logWarning("Could not finalize failed generation", {
        jobId: job.id,
        message: failError instanceof Error ? failError.message : String(failError),
      });
    }
    throw new ProviderError(model.provider, safeMessage);
  }
}

export async function pollGenerationJob(
  ownerId: string,
  jobId: string,
): Promise<{ job: GenerationJob; assets: Awaited<ReturnType<typeof getJobWithAssets>>["assets"] }> {
  const job = await getJob(ownerId, jobId);
  if (job.status !== "running" && job.status !== "queued") {
    return getJobWithAssets(ownerId, jobId);
  }
  if (!job.providerJobId) {
    throw new ProviderError(job.provider, "This generation has no provider job to poll.");
  }
  const adapter = getProviderAdapter(job.provider as ProviderName);
  const result = await adapter.poll(job.providerJobId);
  if (result.status === "running") {
    return { job, assets: [] };
  }
  if (result.status === "cancelled") {
    const failed = await failJob(ownerId, job, "The provider cancelled this generation.", "cancelled");
    return { job: failed, assets: [] };
  }
  if (result.status === "failed") {
    const failed = await failJob(ownerId, job, result.error);
    return { job: failed, assets: [] };
  }
  const model = getGenerationModelForKind(job.model, job.kind);
  const prepared = await storeProviderAssets(
    ownerId,
    {
      kind: job.kind,
      model: job.model,
      prompt: job.prompt,
      aspectRatio: job.settings.aspectRatio,
      durationSeconds: job.settings.durationSeconds,
      outputCount: job.outputCount,
      referenceAssetIds: [],
    },
    model,
    job.id,
    job.sceneId,
    job.projectId,
    result.assets,
    job.settings,
  );
  return completeJob(ownerId, job, prepared, job.providerJobId);
}

export async function cancelGenerationJob(ownerId: string, jobId: string): Promise<GenerationJob> {
  const job = await getJob(ownerId, jobId);
  if (job.status !== "running" && job.status !== "queued") return job;
  if (job.providerJobId) {
    try {
      const adapter = getProviderAdapter(job.provider as ProviderName);
      await adapter.cancel(job.providerJobId);
    } catch (error) {
      logWarning("Provider cancellation failed", {
        jobId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return failJob(ownerId, job, "Generation cancelled by you.", "cancelled");
}

export function generationSetupStatus(): {
  configured: boolean;
  models: string[];
  textAvailable: boolean;
} {
  const catalog = getProviderCatalog("local");
  const available = catalog.models.filter((model) => model.available);
  return {
    configured: available.length > 0,
    models: available.map((model) => model.id),
    textAvailable: catalog.textAvailable,
  };
}
