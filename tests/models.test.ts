import { afterEach, describe, expect, it } from "vitest";
import {
  MODEL_CONFIG,
  estimateCredits,
  getAllModels,
  getGenerationModelForKind,
  getModel,
  getProviderCatalog,
  getTextModel,
  isProviderConfigured,
} from "@/lib/providers/models";

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.JSON2VIDEO_API_KEY;
});

describe("provider catalog", () => {
  it("lists every model but marks unavailable providers honestly", () => {
    const catalog = getProviderCatalog("local");
    expect(catalog.models).toHaveLength(5);
    expect(catalog.models.every((model) => model.available === false)).toBe(true);
    expect(catalog.textAvailable).toBe(false);
    expect(catalog.textProvider).toBeNull();
    expect(catalog.setups).toHaveLength(3);
    expect(catalog.setups.every((setup) => setup.configured === false)).toBe(true);
    expect(catalog.authMode).toBe("local");
    expect(catalog.storageMode).toBe("local");
  });

  it("marks only the configured provider as available", () => {
    process.env.GEMINI_API_KEY = "test-google-key";
    const catalog = getProviderCatalog("supabase");
    const googleModels = catalog.models.filter((model) => model.provider === "google");
    const openaiModels = catalog.models.filter((model) => model.provider === "openai");
    expect(googleModels.length).toBeGreaterThan(0);
    expect(googleModels.every((model) => model.available)).toBe(true);
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(openaiModels.every((model) => model.available)).toBe(false);
    expect(catalog.textAvailable).toBe(true);
    expect(catalog.textProvider).toBe("google");
    expect(catalog.authMode).toBe("supabase");
    expect(isProviderConfigured("google")).toBe(true);
    expect(isProviderConfigured("openai")).toBe(false);
    expect(getTextModel()).toEqual({ provider: "google", model: MODEL_CONFIG.geminiText });
  });

  it("uses OpenAI text when only OpenAI is configured", () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    expect(getTextModel()).toEqual({ provider: "openai", model: MODEL_CONFIG.openaiText });
  });

  it("offers Whisk Flow 1.1 as a render-only video model", () => {
    process.env.JSON2VIDEO_API_KEY = "test-json2video-key";
    const catalog = getProviderCatalog("local");
    const model = catalog.models.find((item) => item.id === MODEL_CONFIG.json2video);
    expect(model).toMatchObject({
      label: "Whisk Flow 1.1",
      provider: "json2video",
      kind: "video",
      available: true,
      supportsReferences: false,
      supportsFirstFrame: false,
      supportsLastFrame: false,
      supportsAudio: false,
      creditUnit: "second",
    });
    expect(model?.aspectRatios).toEqual(["16:9", "9:16", "1:1", "4:5"]);
    expect(catalog.setups.find((setup) => setup.provider === "json2video")?.configured).toBe(true);
    expect(catalog.textAvailable).toBe(false);
    expect(isProviderConfigured("json2video")).toBe(true);
  });

  it("exposes model capabilities that the UI relies on", () => {
    const video = getModel(MODEL_CONFIG.geminiVideo)!;
    expect(video.kind).toBe("video");
    expect(video.supportsFirstFrame).toBe(true);
    expect(video.supportsLastFrame).toBe(true);
    expect(video.supportsAudio).toBe(true);
    expect(video.supportsNegativePrompt).toBe(false);
    expect(video.durations).toEqual([10]);
    expect(video.aspectRatios).toEqual(["16:9", "9:16"]);

    const image = getModel(MODEL_CONFIG.geminiImage)!;
    expect(image.supportsReferences).toBe(true);
    expect(image.supportsNegativePrompt).toBe(false);
    expect(image.maxOutputs).toBe(4);

    const openaiImage = getModel(MODEL_CONFIG.openaiImage)!;
    expect(openaiImage.aspectRatios).toEqual(["1:1", "3:2", "2:3"]);
    expect(openaiImage.supportsReferences).toBe(true);
  });

  it("calculates credits per image and per second", () => {
    const image = getModel(MODEL_CONFIG.geminiImage)!;
    const video = getModel(MODEL_CONFIG.geminiVideo)!;
    expect(estimateCredits(image, { outputCount: 1 })).toBe(image.creditCost);
    expect(estimateCredits(image, { outputCount: 4 })).toBe(image.creditCost * 4);
    expect(estimateCredits(video, { durationSeconds: 10 })).toBe(video.creditCost * 10);
    expect(estimateCredits(video, {})).toBe(video.creditCost * 10);
  });

  it("rejects a model used for the wrong generation kind", () => {
    expect(() => getGenerationModelForKind(MODEL_CONFIG.geminiImage, "video")).toThrow(
      /does not support/i,
    );
    expect(() => getGenerationModelForKind("missing-model", "image")).toThrow(/does not support/i);
  });

  it("returns every internal model with its configured default id", () => {
    const ids = getAllModels().map((model) => model.id);
    expect(ids).toContain(MODEL_CONFIG.geminiImage);
    expect(ids).toContain(MODEL_CONFIG.geminiVideo);
    expect(ids).toContain(MODEL_CONFIG.openaiImage);
    expect(ids).toContain(MODEL_CONFIG.openaiPrecisionImage);
    expect(ids).toContain(MODEL_CONFIG.json2video);
  });
});
