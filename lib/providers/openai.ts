import "server-only";
import { ProviderError } from "@/lib/errors";
import { fetchWithPolicy, readJsonResponse } from "@/lib/providers/http";
import type {
  ProviderAdapter,
  ProviderCreateResult,
  ProviderGenerationRequest,
  ProviderOutputAsset,
} from "@/lib/providers/types";

const BASE_URL = "https://api.openai.com/v1";

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new ProviderError("openai", "OpenAI is not connected. Add OPENAI_API_KEY on the server.");
  }
  return key;
}

function headers(extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey()}`,
    ...extra,
  };
}

function sizeFor(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return "1024x1024";
  if (w === h) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  error?: { message?: string };
}

async function downloadUrl(url: string): Promise<Buffer> {
  const response = await fetchWithPolicy("openai", url, { method: "GET", timeoutMs: 60_000, retries: 1 });
  if (!response.ok) {
    throw new ProviderError("openai", "OpenAI returned an image URL that could not be downloaded.");
  }
  return Buffer.from(await response.arrayBuffer());
}

async function createImage(request: ProviderGenerationRequest): Promise<ProviderCreateResult> {
  const count = Math.max(1, Math.min(request.outputCount, request.model.maxOutputs));
  const quality = request.quality || "high";

  let response: Response;
  if (request.images.length > 0) {
    const form = new FormData();
    form.append("model", request.model.id);
    form.append("prompt", request.prompt);
    form.append("n", String(count));
    form.append("size", sizeFor(request.aspectRatio));
    form.append("quality", quality);
    form.append("output_format", "png");
    request.images.forEach((image, index) => {
      const blob = new Blob([new Uint8Array(image.data)], { type: image.mimeType });
      const field = request.images.length > 1 ? "image[]" : "image";
      form.append(field, blob, `reference-${index + 1}.png`);
    });
    response = await fetchWithPolicy("openai", `${BASE_URL}/images/edits`, {
      method: "POST",
      headers: headers(),
      body: form,
      timeoutMs: 180_000,
      retries: 1,
    });
  } else {
    response = await fetchWithPolicy("openai", `${BASE_URL}/images/generations`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: request.model.id,
        prompt: request.prompt,
        n: count,
        size: sizeFor(request.aspectRatio),
        quality,
        output_format: "png",
      }),
      timeoutMs: 180_000,
      retries: 1,
    });
  }

  const payload = await readJsonResponse<OpenAIImageResponse>("openai", response);
  if (!payload.data || payload.data.length === 0) {
    return {
      status: "failed",
      error: payload.error?.message || "OpenAI completed without returning an image.",
    };
  }

  const assets: ProviderOutputAsset[] = [];
  for (const item of payload.data) {
    if (item.b64_json) {
      assets.push({ data: Buffer.from(item.b64_json, "base64"), mimeType: "image/png" });
    } else if (item.url) {
      assets.push({ data: await downloadUrl(item.url), mimeType: "image/png" });
    }
  }
  if (assets.length === 0) {
    return { status: "failed", error: "OpenAI returned no usable image data." };
  }
  return { status: "succeeded", assets };
}

export const openaiAdapter: ProviderAdapter = {
  async create(request: ProviderGenerationRequest): Promise<ProviderCreateResult> {
    if (request.model.kind === "video") {
      return {
        status: "failed",
        error: "OpenAI video generation is not supported in Whisk Flow. Choose a Gemini Omni model.",
      };
    }
    return createImage(request);
  },

  async poll(): Promise<never> {
    throw new ProviderError("openai", "OpenAI image generation completes synchronously.");
  },

  async cancel(): Promise<void> {
    // OpenAI image generation has no remote cancellation endpoint.
  },
};

interface OpenAIResponsesResult {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

export async function openaiPrompt(prompt: string, system: string): Promise<string> {
  const response = await fetchWithPolicy("openai", `${BASE_URL}/responses`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
      instructions: system,
      input: prompt,
      max_output_tokens: 1200,
    }),
    timeoutMs: 90_000,
    retries: 1,
  });
  const payload = await readJsonResponse<OpenAIResponsesResult>("openai", response);
  if (payload.output_text?.trim()) return payload.output_text.trim();
  const text = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" || item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
  if (!text) {
    throw new ProviderError("openai", payload.error?.message || "OpenAI returned an empty response.");
  }
  return text;
}
