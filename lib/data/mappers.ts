import type {
  Asset,
  CreditTransaction,
  ExportRecord,
  GenerationJob,
  GenerationSettings,
  Project,
  ProjectMode,
  ProjectSettings,
  ProjectStatus,
  Scene,
  SceneStatus,
} from "@/lib/types";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = number(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  return new Date().toISOString();
}

function nullableIso(value: unknown): string | null {
  return value == null ? null : iso(value);
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

export function mapProject(row: Row): Project {
  return {
    id: text(row.id),
    ownerId: text(row.owner_id),
    title: text(row.title, "Untitled project"),
    description: text(row.description),
    mode: (text(row.mode, "video") as ProjectMode) ?? "video",
    status: (text(row.status, "draft") as ProjectStatus) ?? "draft",
    aspectRatio: text(row.aspect_ratio, "16:9"),
    provider: nullableText(row.provider),
    model: nullableText(row.model),
    settings: jsonObject(row.settings) as ProjectSettings,
    promptHistory: jsonArray<string>(row.prompt_history),
    exportHistory: jsonArray<ExportRecord>(row.export_history),
    coverAssetId: nullableText(row.cover_asset_id),
    templateSlug: nullableText(row.template_slug),
    isExample: Boolean(row.is_example),
    favorite: Boolean(row.favorite),
    deletedAt: nullableIso(row.deleted_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapScene(row: Row): Scene {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    ownerId: text(row.owner_id),
    title: text(row.title, "Untitled scene"),
    prompt: text(row.prompt),
    negativePrompt: text(row.negative_prompt),
    durationSeconds: number(row.duration_seconds, 4),
    orderIndex: number(row.order_index),
    status: (text(row.status, "draft") as SceneStatus) ?? "draft",
    referenceAssetIds: textArray(row.reference_asset_ids),
    firstFrameAssetId: nullableText(row.first_frame_asset_id),
    lastFrameAssetId: nullableText(row.last_frame_asset_id),
    transition: (text(row.transition, "cut") as Scene["transition"]) ?? "cut",
    thumbnailUrl: nullableText(row.thumbnail_url),
    videoAssetId: nullableText(row.video_asset_id),
    generationJobId: nullableText(row.generation_job_id),
    error: nullableText(row.error),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapAsset(row: Row): Asset {
  const id = text(row.id);
  const storagePath = nullableText(row.storage_path);
  const privateUrl = storagePath ? `/api/media/${id}` : null;
  return {
    id,
    ownerId: text(row.owner_id),
    projectId: nullableText(row.project_id),
    sceneId: nullableText(row.scene_id),
    kind: (text(row.kind, "image") as Asset["kind"]) ?? "image",
    title: text(row.title, "Untitled asset"),
    url: privateUrl ?? nullableText(row.url),
    thumbnailUrl:
      (storagePath ? `${privateUrl}?variant=thumb` : null) ?? nullableText(row.thumbnail_url),
    storageProvider: (text(row.storage_provider, "local") as Asset["storageProvider"]) ?? "local",
    storagePath,
    mimeType: text(row.mime_type, "application/octet-stream"),
    sizeBytes: number(row.size_bytes),
    width: nullableNumber(row.width),
    height: nullableNumber(row.height),
    durationSeconds: nullableNumber(row.duration_seconds),
    prompt: nullableText(row.prompt),
    negativePrompt: nullableText(row.negative_prompt),
    provider: nullableText(row.provider),
    model: nullableText(row.model),
    aspectRatio: nullableText(row.aspect_ratio),
    source: (text(row.source, "upload") as Asset["source"]) ?? "upload",
    folder: text(row.folder, "Unsorted"),
    tags: textArray(row.tags),
    favorite: Boolean(row.favorite),
    metadata: jsonObject(row.metadata),
    isExample: Boolean(row.is_example),
    deletedAt: nullableIso(row.deleted_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapJob(row: Row): GenerationJob {
  const settings = jsonObject(row.settings) as GenerationSettings;
  return {
    id: text(row.id),
    ownerId: text(row.owner_id),
    projectId: nullableText(row.project_id),
    sceneId: nullableText(row.scene_id),
    kind: (text(row.kind, "image") as GenerationJob["kind"]) ?? "image",
    provider: text(row.provider),
    model: text(row.model),
    status: (text(row.status, "queued") as GenerationJob["status"]) ?? "queued",
    prompt: text(row.prompt),
    negativePrompt: text(row.negative_prompt),
    settings: {
      ...settings,
      aspectRatio: text(settings.aspectRatio, "16:9"),
    },
    outputCount: number(row.output_count, 1),
    creditsReserved: number(row.credits_reserved),
    providerJobId: nullableText(row.provider_job_id),
    resultAssetId: nullableText(row.result_asset_id),
    assetIds: jsonArray<string>(row.asset_ids),
    error: nullableText(row.error),
    attempts: number(row.attempts, 1),
    idempotencyKey: text(row.idempotency_key),
    startedAt: nullableIso(row.started_at),
    completedAt: nullableIso(row.completed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapTransaction(row: Row): CreditTransaction {
  return {
    id: text(row.id),
    ownerId: text(row.owner_id),
    generationId: nullableText(row.generation_id),
    type: (text(row.type, "adjustment") as CreditTransaction["type"]) ?? "adjustment",
    amount: number(row.amount),
    reservedDelta: number(row.reserved_delta),
    balanceAfter: number(row.balance_after),
    description: text(row.description),
    metadata: jsonObject(row.metadata),
    createdAt: iso(row.created_at),
  };
}

export function mapProfile(row: Row) {
  return {
    id: text(row.id),
    email: text(row.email),
    fullName: text(row.full_name, text(row.email).split("@")[0] ?? "Creator"),
    avatarUrl: nullableText(row.avatar_url),
    plan: text(row.plan, "free"),
    credits: number(row.credits, 0),
    reservedCredits: number(row.reserved_credits, 0),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
