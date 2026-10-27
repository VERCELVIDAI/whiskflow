import "server-only";
import { getTextModel } from "@/lib/providers/models";
import { googlePrompt } from "@/lib/providers/google";
import { openaiPrompt } from "@/lib/providers/openai";
import { STYLE_PRESETS } from "@/lib/config";

export type PromptAction =
  | "enhance"
  | "cinematic"
  | "realistic"
  | "camera"
  | "variations"
  | "simplify"
  | "translate";

const ACTION_LABELS: Record<PromptAction, string> = {
  enhance: "Enhance",
  cinematic: "Cinematic",
  realistic: "Photoreal",
  camera: "Camera direction",
  variations: "Variations",
  simplify: "Simplify",
  translate: "Translate",
};

export interface PromptAssistantResult {
  text: string;
  source: "provider" | "local";
  provider: "google" | "openai" | null;
  model: string | null;
  action: PromptAction;
  note: string;
}

function localEnhance(prompt: string, mode: "image" | "video", action: PromptAction): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const details: string[] = [];

  if (action === "simplify") {
    const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
    return firstSentence.length > 180 ? `${firstSentence.slice(0, 177).trim()}…` : firstSentence;
  }

  if (action === "translate") {
    return clean;
  }

  if (action === "variations") {
    const directions = [
      "intimate close-up, shallow depth of field, quiet emotional beat",
      "wide establishing shot, dramatic scale, layered atmosphere",
      "low-angle hero framing, bold silhouette, kinetic energy",
    ];
    return directions
      .map((direction, index) => `${index + 1}. ${clean} — ${direction}.`)
      .join("\n");
  }

  if (action === "cinematic" || mode === "video") {
    if (!lower.includes("camera") && !lower.includes("shot")) {
      details.push("Camera: slow push-in on a 35mm anamorphic lens");
    }
    if (!lower.includes("light")) details.push("Lighting: warm practicals against cool ambient shadows");
    if (!lower.includes("film") && !lower.includes("grain")) details.push("Texture: subtle film grain and halation");
    if (!lower.includes("audio") && mode === "video") details.push("Audio: intimate room tone and a low cinematic pulse");
  }

  if (action === "realistic") {
    details.push("Natural skin texture, true-to-life color science, physically plausible light");
    details.push("Documentary-style imperfections, no plastic surfaces, no over-sharpening");
  }

  if (action === "camera") {
    details.push("Shot on a full-frame cinema camera, 40mm lens, T2.0");
    details.push("Motivated camera movement, stable horizon, deliberate focus pull");
  }

  if (action === "enhance" || details.length === 0) {
    details.push("Composition: clear focal subject with foreground, midground and background layers");
    details.push("Grade: restrained contrast, rich shadow detail, natural highlights");
  }

  const style = STYLE_PRESETS.find((preset) => lower.includes(preset.id));
  if (style) details.push(`Style: ${style.suffix}`);

  return `${clean.replace(/[.\s]+$/, "")}. ${details.join(". ")}.`.replace(/\.\./g, ".");
}

function systemPrompt(mode: "image" | "video", action: PromptAction, targetLanguage: string): string {
  const output = mode === "video" ? "video generation" : "image generation";
  const actionInstructions: Record<PromptAction, string> = {
    enhance:
      "Rewrite the idea as a production-ready prompt. Add subject, environment, composition, lighting, lens, texture and mood. Do not add unrelated story.",
    cinematic:
      "Rewrite as a cinematic prompt with camera movement, lens language, lighting design, production design, color grade and sound direction if video.",
    realistic:
      "Rewrite for photorealistic output. Emphasize natural texture, plausible physics, real-world lighting and camera behavior. Avoid stylization.",
    camera:
      "Keep the idea intact and add precise camera direction: shot size, angle, lens, aperture, movement, focus and framing.",
    variations:
      "Return exactly three distinct creative directions as a numbered list. Each direction must be a complete standalone prompt.",
    simplify:
      "Return one concise prompt under 60 words. Preserve the essential subject and action. Remove decorative language.",
    translate:
      `Translate the prompt into ${targetLanguage}. Preserve visual details and do not add commentary. Return only the translation.`,
  };
  return [
    `You are the prompt assistant inside Whisk Flow, a premium AI filmmaking studio.`,
    `The user is preparing ${output}.`,
    actionInstructions[action],
    "Return only the finished prompt text. No preamble, no quotation marks, no markdown fences.",
  ].join(" ");
}

export async function runPromptAssistant(input: {
  prompt: string;
  action: PromptAction;
  mode: "image" | "video";
  targetLanguage?: string;
}): Promise<PromptAssistantResult> {
  const textModel = getTextModel();
  if (!textModel) {
    return {
      text: localEnhance(input.prompt, input.mode, input.action),
      source: "local",
      provider: null,
      model: null,
      action: input.action,
      note: `Local ${ACTION_LABELS[input.action].toLowerCase()} fallback — no language model is connected.`,
    };
  }

  try {
    const system = systemPrompt(input.mode, input.action, input.targetLanguage || "English");
    const userPrompt =
      input.action === "translate"
        ? `Translate this prompt into ${input.targetLanguage || "English"}:\n\n${input.prompt}`
        : input.prompt;
    const text =
      textModel.provider === "google"
        ? await googlePrompt(userPrompt, system)
        : await openaiPrompt(userPrompt, system);
    return {
      text: text.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/, "").trim(),
      source: "provider",
      provider: textModel.provider,
      model: textModel.model,
      action: input.action,
      note: `${ACTION_LABELS[input.action]} by ${textModel.provider === "google" ? "Gemini" : "OpenAI"}.`,
    };
  } catch (error) {
    return {
      text: localEnhance(input.prompt, input.mode, input.action),
      source: "local",
      provider: null,
      model: null,
      action: input.action,
      note: `Provider unavailable — local ${ACTION_LABELS[input.action].toLowerCase()} fallback used. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    };
  }
}
