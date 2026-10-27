import type { ProviderCatalog, PublicModel } from "@/lib/types";

export type ProviderName = "google" | "openai" | "json2video";
export type TextProviderName = "google" | "openai";

export interface InternalModel extends Omit<PublicModel, "available"> {
  inputModes: Array<"text-to-image" | "image-to-image" | "text-to-video" | "image-to-video">;
}

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.1-flash";
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
const OPENAI_PRECISION_IMAGE_MODEL =
  process.env.OPENAI_PRECISION_IMAGE_MODEL || "gpt-image-2.5-sunburst";
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-6-luna";
const JSON2VIDEO_MODEL = process.env.JSON2VIDEO_MODEL || "whisk-flow-1.1";

function creditOverrides(): Record<string, number> {
  const raw = process.env.CREDIT_COST_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)])
        .filter(([, value]) => Number.isFinite(value) && Number(value) > 0),
    );
  } catch {
    return {};
  }
}

function costFor(modelId: string, fallback: number): number {
  return creditOverrides()[modelId] ?? fallback;
}

const IMAGE_RATIOS = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

const ALL_MODELS: InternalModel[] = [
  {
    id: GEMINI_IMAGE_MODEL,
    label: "Nano Banana 2.1",
    provider: "google",
    providerLabel: "Google",
    kind: "image",
    description:
      "Google's high-efficiency image model with reference-guided editing, legible text and up to 4K output.",
    aspectRatios: IMAGE_RATIOS,
    resolutions: ["1K", "2K", "4K"],
    durations: [],
    supportsNegativePrompt: false,
    supportsReferences: true,
    supportsFirstFrame: false,
    supportsLastFrame: false,
    supportsAudio: false,
    maxOutputs: 4,
    creditCost: costFor(GEMINI_IMAGE_MODEL, 10),
    creditUnit: "image",
    badge: "Recommended",
    inputModes: ["text-to-image", "image-to-image"],
  },
  {
    id: OPENAI_IMAGE_MODEL,
    label: "GPT Image 2.5 Flare",
    provider: "openai",
    providerLabel: "OpenAI",
    kind: "image",
    description:
      "Fast, high-quality image generation with strong prompt adherence and natural in-image typography.",
    aspectRatios: ["1:1", "3:2", "2:3"],
    resolutions: ["Auto"],
    durations: [],
    supportsNegativePrompt: false,
    supportsReferences: true,
    supportsFirstFrame: false,
    supportsLastFrame: false,
    supportsAudio: false,
    maxOutputs: 4,
    creditCost: costFor(OPENAI_IMAGE_MODEL, 12),
    creditUnit: "image",
    badge: "Fast",
    inputModes: ["text-to-image", "image-to-image"],
  },
  {
    id: OPENAI_PRECISION_IMAGE_MODEL,
    label: "GPT Image 2.5 Sunburst",
    provider: "openai",
    providerLabel: "OpenAI",
    kind: "image",
    description:
      "Precision-focused GPT Image model for detailed creative work, precise edits and complex compositions.",
    aspectRatios: ["1:1", "3:2", "2:3"],
    resolutions: ["Auto"],
    durations: [],
    supportsNegativePrompt: false,
    supportsReferences: true,
    supportsFirstFrame: false,
    supportsLastFrame: false,
    supportsAudio: false,
    maxOutputs: 4,
    creditCost: costFor(OPENAI_PRECISION_IMAGE_MODEL, 20),
    creditUnit: "image",
    badge: "Precision",
    inputModes: ["text-to-image", "image-to-image"],
  },
  {
    id: GEMINI_VIDEO_MODEL,
    label: "Gemini Omni 1.1",
    provider: "google",
    providerLabel: "Google",
    kind: "video",
    description:
      "Cinematic video with native audio, first/last-frame interpolation and reference-to-video control.",
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p", "4k"],
    durations: [10],
    supportsNegativePrompt: false,
    supportsReferences: true,
    supportsFirstFrame: true,
    supportsLastFrame: true,
    supportsAudio: true,
    maxOutputs: 1,
    creditCost: costFor(GEMINI_VIDEO_MODEL, 8),
    creditUnit: "second",
    badge: "Native audio",
    inputModes: ["text-to-video", "image-to-video"],
  },
  {
    id: JSON2VIDEO_MODEL,
    label: "Whisk Flow 1.1",
    provider: "json2video",
    providerLabel: "Whisk Flow",
    kind: "video",
    description:
      "A 10-second, text-led motion graphic rendered by JSON2Video: designed cinematic backgrounds, animated typography and a finished MP4. It composes motion graphics rather than photoreal footage. Free JSON2Video plans include a small JSON2Video watermark.",
    aspectRatios: ["16:9", "9:16", "1:1", "4:5"],
    resolutions: ["720p", "1080p"],
    durations: [10],
    supportsNegativePrompt: false,
    supportsReferences: false,
    supportsFirstFrame: false,
    supportsLastFrame: false,
    supportsAudio: false,
    maxOutputs: 1,
    creditCost: costFor(JSON2VIDEO_MODEL, 6),
    creditUnit: "second",
    badge: "Render engine",
    inputModes: ["text-to-video"],
  },
];

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isJson2VideoConfigured(): boolean {
  return Boolean(process.env.JSON2VIDEO_API_KEY);
}

export function isProviderConfigured(provider: ProviderName): boolean {
  if (provider === "google") return isGeminiConfigured();
  if (provider === "openai") return isOpenAIConfigured();
  return isJson2VideoConfigured();
}

export function providerEnvVariable(provider: ProviderName): string {
  if (provider === "google") return "GEMINI_API_KEY";
  if (provider === "openai") return "OPENAI_API_KEY";
  return "JSON2VIDEO_API_KEY";
}

export function getAllModels(): InternalModel[] {
  return ALL_MODELS;
}

export function getModel(modelId: string): InternalModel | undefined {
  return ALL_MODELS.find((model) => model.id === modelId);
}

export function getAvailableModels(kind?: "image" | "video"): PublicModel[] {
  return ALL_MODELS.filter(
    (model) => isProviderConfigured(model.provider) && (!kind || model.kind === kind),
  ).map(stripInternal);
}

export function getDefaultModel(kind: "image" | "video"): InternalModel | null {
  return (
    ALL_MODELS.find((model) => model.kind === kind && isProviderConfigured(model.provider)) ?? null
  );
}

function stripInternal(model: InternalModel): PublicModel {
  return {
    id: model.id,
    label: model.label,
    provider: model.provider,
    providerLabel: model.providerLabel,
    kind: model.kind,
    available: isProviderConfigured(model.provider),
    description: model.description,
    aspectRatios: model.aspectRatios,
    resolutions: model.resolutions,
    durations: model.durations,
    supportsNegativePrompt: model.supportsNegativePrompt,
    supportsReferences: model.supportsReferences,
    supportsFirstFrame: model.supportsFirstFrame,
    supportsLastFrame: model.supportsLastFrame,
    supportsAudio: model.supportsAudio,
    maxOutputs: model.maxOutputs,
    creditCost: model.creditCost,
    creditUnit: model.creditUnit,
    badge: model.badge,
  };
}

export function getTextModel(): { provider: TextProviderName; model: string } | null {
  if (isGeminiConfigured()) {
    return { provider: "google", model: GEMINI_TEXT_MODEL };
  }
  if (isOpenAIConfigured()) {
    return { provider: "openai", model: OPENAI_TEXT_MODEL };
  }
  return null;
}

export function getProviderCatalog(authMode: "local" | "supabase"): ProviderCatalog {
  const text = getTextModel();
  return {
    models: ALL_MODELS.map(stripInternal),
    textAvailable: Boolean(text),
    textProvider: text?.provider ?? null,
    setups: [
      {
        provider: "google",
        label: "Google Gemini",
        configured: isGeminiConfigured(),
        envVariables: ["GEMINI_API_KEY"],
        note: "Enables Nano Banana image generation, Gemini Omni video with native audio, and the prompt assistant.",
      },
      {
        provider: "openai",
        label: "OpenAI",
        configured: isOpenAIConfigured(),
        envVariables: ["OPENAI_API_KEY"],
        note: "Enables GPT Image 2.5 Flare and Sunburst plus the prompt assistant. Video requires Google Gemini Omni or Whisk Flow 1.1.",
      },
      {
        provider: "json2video",
        label: "Whisk Flow 1.1 (JSON2Video)",
        configured: isJson2VideoConfigured(),
        envVariables: ["JSON2VIDEO_API_KEY"],
        note: "Enables Whisk Flow 1.1: a 10-second text-led motion-graphics renderer with designed backgrounds and animated typography. It does not synthesize photoreal footage. Free JSON2Video plans add a JSON2Video watermark; paid plans remove it.",
      },
    ],
    authMode,
    storageMode:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
        ? "supabase"
        : "local",
  };
}

export function estimateCredits(
  model: InternalModel,
  options: { durationSeconds?: number; outputCount?: number } = {},
): number {
  if (model.creditUnit === "second") {
    const duration = options.durationSeconds ?? model.durations[0] ?? 10;
    return Math.max(1, model.creditCost * duration);
  }
  return Math.max(1, model.creditCost * (options.outputCount ?? 1));
}

export function getGenerationModelForKind(
  modelId: string,
  kind: "image" | "video",
): InternalModel {
  const model = getModel(modelId);
  if (!model || model.kind !== kind) {
    throw new Error("The selected model does not support this generation type.");
  }
  return model;
}

export const MODEL_CONFIG = {
  geminiImage: GEMINI_IMAGE_MODEL,
  geminiVideo: GEMINI_VIDEO_MODEL,
  geminiText: GEMINI_TEXT_MODEL,
  openaiImage: OPENAI_IMAGE_MODEL,
  openaiPrecisionImage: OPENAI_PRECISION_IMAGE_MODEL,
  openaiText: OPENAI_TEXT_MODEL,
  json2video: JSON2VIDEO_MODEL,
};
