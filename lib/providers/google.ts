import "server-only";
import { ProviderError } from "@/lib/errors";
import { fetchWithPolicy, readJsonResponse } from "@/lib/providers/http";
import type {
  ProviderAdapter,
  ProviderCreateResult,
  ProviderGenerationRequest,
  ProviderOutputAsset,
  ProviderPollResult,
} from "@/lib/providers/types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const API_REVISION = "2026-05-20";

interface GoogleContent {
  type?: string;
  text?: string;
  data?: string;
  mime_type?: string;
}

interface GoogleStep {
  type?: string;
  content?: GoogleContent[];
  summary?: GoogleContent[];
}

interface GoogleInteraction {
  id?: string;
  status?: string;
  steps?: GoogleStep[];
  error?: { message?: string; code?: string | number };
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ProviderError("google", "Google Gemini is not connected. Add GEMINI_API_KEY on the server.");
  }
  return key;
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey(),
    "Api-Revision": API_REVISION,
  };
}

async function createInteraction(body: Record<string, unknown>): Promise<GoogleInteraction> {
  const response = await fetchWithPolicy("google", `${BASE_URL}/interactions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    timeoutMs: 120_000,
    retries: 1,
  });
  return readJsonResponse<GoogleInteraction>("google", response);
}

async function getInteraction(id: string): Promise<GoogleInteraction> {
  const response = await fetchWithPolicy("google", `${BASE_URL}/interactions/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: headers(),
    timeoutMs: 30_000,
    retries: 2,
  });
  return readJsonResponse<GoogleInteraction>("google", response);
}

function imageSize(resolution?: string): string {
  if (resolution === "4K" || resolution === "4k") return "4K";
  if (resolution === "2K" || resolution === "2k") return "2K";
  return "1K";
}

function inputContent(prompt: string, images: ProviderGenerationRequest["images"]) {
  const contents: GoogleContent[] = [];
  for (const image of images) {
    contents.push({
      type: "image",
      mime_type: image.mimeType,
      data: image.data.toString("base64"),
    });
  }
  contents.push({ type: "text", text: prompt });
  return contents;
}

function extractAssets(interaction: GoogleInteraction): ProviderOutputAsset[] {
  const assets: ProviderOutputAsset[] = [];
  for (const step of interaction.steps ?? []) {
    if (step.type !== "model_output" && step.type !== "output") continue;
    for (const content of step.content ?? []) {
      if (!content.data || !content.type) continue;
      if (content.type === "image" || content.type === "video") {
        assets.push({
          data: Buffer.from(content.data, "base64"),
          mimeType: content.mime_type || (content.type === "image" ? "image/png" : "video/mp4"),
          durationSeconds: content.type === "video" ? 10 : undefined,
        });
      }
    }
  }
  return assets;
}

function extractText(interaction: GoogleInteraction): string {
  const chunks: string[] = [];
  for (const step of interaction.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const content of step.content ?? []) {
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function interactionError(interaction: GoogleInteraction): string {
  return (
    interaction.error?.message ||
    "Gemini could not complete this generation. Try a different prompt or model."
  );
}

function videoTask(request: ProviderGenerationRequest): string {
  const hasFirst = request.images.some((image) => image.role === "first-frame");
  const hasLast = request.images.some((image) => image.role === "last-frame");
  if (hasFirst || hasLast) return "image_to_video";
  if (request.images.length > 0) return "reference_to_video";
  return "text_to_video";
}

async function createVideo(request: ProviderGenerationRequest): Promise<ProviderCreateResult> {
  const responseFormat: Record<string, unknown> = {
    type: "video",
    aspect_ratio: request.aspectRatio,
    resolution: request.resolution === "4k" ? "4k" : request.resolution || "720p",
  };
  const body: Record<string, unknown> = {
    model: request.model.id,
    input: inputContent(request.prompt, request.images),
    response_format: responseFormat,
    background: true,
    generation_config: {
      video_config: { task: videoTask(request) },
    },
  };
  const interaction = await createInteraction(body);
  if (interaction.status === "failed") {
    return { status: "failed", error: interactionError(interaction) };
  }
  if (interaction.status === "completed") {
    const assets = extractAssets(interaction);
    if (assets.length === 0) {
      return { status: "failed", error: "Gemini completed without returning a video." };
    }
    return { status: "succeeded", assets, providerJobId: interaction.id };
  }
  if (!interaction.id) {
    return { status: "failed", error: "Gemini did not return an interaction id." };
  }
  return { status: "running", providerJobId: interaction.id };
}

async function createImage(request: ProviderGenerationRequest): Promise<ProviderCreateResult> {
  const count = Math.max(1, Math.min(request.outputCount, request.model.maxOutputs));
  const tasks = Array.from({ length: count }, async () => {
    const body: Record<string, unknown> = {
      model: request.model.id,
      input: inputContent(request.prompt, request.images),
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: request.aspectRatio,
        image_size: imageSize(request.resolution),
      },
    };
    const interaction = await createInteraction(body);
    if (interaction.status === "failed") {
      throw new ProviderError("google", interactionError(interaction));
    }
    const assets = extractAssets(interaction);
    if (assets.length === 0) {
      throw new ProviderError("google", "Gemini completed without returning an image.");
    }
    return assets;
  });

  try {
    const groups = await Promise.all(tasks);
    return { status: "succeeded", assets: groups.flat() };
  } catch (error) {
    if (error instanceof ProviderError) return { status: "failed", error: error.message };
    throw error;
  }
}

export const googleAdapter: ProviderAdapter = {
  async create(request: ProviderGenerationRequest): Promise<ProviderCreateResult> {
    if (request.model.kind === "video") return createVideo(request);
    return createImage(request);
  },

  async poll(providerJobId: string): Promise<ProviderPollResult> {
    const interaction = await getInteraction(providerJobId);
    switch (interaction.status) {
      case "completed": {
        const assets = extractAssets(interaction);
        if (assets.length === 0) {
          return { status: "failed", error: "Gemini completed without returning a video." };
        }
        return { status: "succeeded", assets };
      }
      case "failed":
        return { status: "failed", error: interactionError(interaction) };
      case "cancelled":
        return { status: "cancelled" };
      case "requires_action":
        return {
          status: "failed",
          error: "Gemini paused this interaction for an action that Whisk Flow does not support.",
        };
      default:
        return { status: "running" };
    }
  },

  async cancel(providerJobId: string): Promise<void> {
    const response = await fetchWithPolicy(
      "google",
      `${BASE_URL}/interactions/${encodeURIComponent(providerJobId)}/cancel`,
      { method: "POST", headers: headers(), timeoutMs: 20_000, retries: 1 },
    );
    if (!response.ok && response.status !== 404 && response.status !== 409) {
      await readJsonResponse("google", response);
    }
  },
};

export async function googlePrompt(prompt: string, system: string): Promise<string> {
  const interaction = await createInteraction({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
    input: prompt,
    system_instruction: system,
  });
  if (interaction.status === "failed") {
    throw new ProviderError("google", interactionError(interaction));
  }
  const text = extractText(interaction);
  if (!text) throw new ProviderError("google", "Gemini returned an empty response.");
  return text;
}
