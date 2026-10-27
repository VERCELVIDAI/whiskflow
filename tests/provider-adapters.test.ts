import { afterEach, describe, expect, it, vi } from "vitest";
import { googleAdapter, googlePrompt } from "@/lib/providers/google";
import { json2videoAdapter } from "@/lib/providers/json2video";
import { openaiAdapter, openaiPrompt } from "@/lib/providers/openai";
import { MODEL_CONFIG, getModel } from "@/lib/providers/models";
import type { ProviderGenerationRequest } from "@/lib/providers/types";

function request(overrides: Partial<ProviderGenerationRequest> = {}): ProviderGenerationRequest {
  return {
    model: getModel(MODEL_CONFIG.geminiImage)!,
    prompt: "A lighthouse in fog",
    negativePrompt: "",
    aspectRatio: "1:1",
    resolution: "1K",
    outputCount: 1,
    images: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.JSON2VIDEO_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Google Interactions adapter", () => {
  it("parses image data from interaction steps", async () => {
    process.env.GEMINI_API_KEY = "test-google-key";
    const image = Buffer.from("fake-png").toString("base64");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          id: "interaction_1",
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "image", mime_type: "image/png", data: image }],
            },
          ],
        }),
      ),
    );

    const result = await googleAdapter.create(request());
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("Expected success");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].mimeType).toBe("image/png");
    expect(result.assets[0].data.toString()).toBe("fake-png");
  });

  it("turns provider failures into failed generation results", async () => {
    process.env.GEMINI_API_KEY = "test-google-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: { message: "quota exhausted" } }, 429)),
    );

    const result = await googleAdapter.create(request());
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Expected failure");
    expect(result.error).toBe(
      "The provider rate limit was reached. Wait a moment, then try again.",
    );
  });

  it("requires a server API key before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await googleAdapter.create(request());
    expect(result.status).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses prompt text from a text interaction", async () => {
    process.env.GEMINI_API_KEY = "test-google-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: "A precise cinematic prompt." }],
            },
          ],
        }),
      ),
    );
    await expect(googlePrompt("make it cinematic", "system")).resolves.toBe(
      "A precise cinematic prompt.",
    );
  });
});

describe("OpenAI adapter", () => {
  it("parses base64 image output", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const image = Buffer.from("fake-openai-png").toString("base64");
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => jsonResponse({ data: [{ b64_json: image }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await openaiAdapter.create(
      request({
        model: getModel(MODEL_CONFIG.openaiImage)!,
        aspectRatio: "1:1",
      }),
    );
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("Expected success");
    expect(result.assets[0].data.toString()).toBe("fake-openai-png");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      model: MODEL_CONFIG.openaiImage,
      n: 1,
      size: "1024x1024",
      output_format: "png",
    });
  });

  it("fails honestly for video requests", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const result = await openaiAdapter.create(
      request({
        model: getModel(MODEL_CONFIG.geminiVideo)!,
        aspectRatio: "16:9",
      }),
    );
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Expected failure");
    expect(result.error).toMatch(/not supported/i);
  });

  it("parses prompt text from the Responses API", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ output_text: "A refined prompt." })),
    );
    await expect(openaiPrompt("refine this", "system")).resolves.toBe("A refined prompt.");
  });
});

describe("Whisk Flow 1.1 JSON2Video adapter", () => {
  it("submits a designed movie and returns the render project", async () => {
    process.env.JSON2VIDEO_API_KEY = "test-json2video-key";
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => jsonResponse({ success: true, project: "AbCdEfGhIjKlMnOp" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await json2videoAdapter.create(
      request({
        model: getModel(MODEL_CONFIG.json2video)!,
        prompt: "A rain-soaked Tokyo alley at night, neon reflections on wet asphalt.",
        aspectRatio: "16:9",
        resolution: "1080p",
        durationSeconds: 10,
      }),
    );

    expect(result).toEqual({ status: "running", providerJobId: "AbCdEfGhIjKlMnOp" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.json2video.com/v2/movies");
    expect(init?.headers).toMatchObject({ "x-api-key": "test-json2video-key" });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      resolution: "full-hd",
      quality: "high",
      scenes: [{ duration: 10 }],
    });
    expect(body.scenes[0].elements[0]).toMatchObject({ type: "html", width: "100%" });
    expect(body.elements.filter((element: { type: string }) => element.type === "text")).toHaveLength(3);
    expect(body.elements[1].text).toContain("rain-soaked Tokyo");
  });

  it("does not duplicate terminal punctuation when truncating a title", async () => {
    process.env.JSON2VIDEO_API_KEY = "test-json2video-key";
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => jsonResponse({ success: true, project: "AbCdEfGhIjKlMnOp" }));
    vi.stubGlobal("fetch", fetchMock);

    await json2videoAdapter.create(
      request({
        model: getModel(MODEL_CONFIG.json2video)!,
        prompt:
          "A rain-soaked Tokyo alley at night, neon reflections on wet asphalt, a lone figure. The camera drifts slowly toward the light at the end of the street.",
        aspectRatio: "16:9",
        resolution: "720p",
        durationSeconds: 10,
      }),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const title = body.elements[1].text;
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\.…$/);
    expect(title).not.toContain("....");
  });

  it("downloads the finished MP4 when polling", async () => {
    process.env.JSON2VIDEO_API_KEY = "test-json2video-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.json2video.com/v2/movies")) {
        return jsonResponse({
          success: true,
          movie: {
            status: "done",
            url: "https://cdn.example.test/render.mp4",
            width: 1920,
            height: 1080,
            duration: 10,
          },
        });
      }
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await json2videoAdapter.poll("AbCdEfGhIjKlMnOp");
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("Expected success");
    expect(result.assets[0]).toMatchObject({
      mimeType: "video/mp4",
      width: 1920,
      height: 1080,
      durationSeconds: 10,
    });
    expect(result.assets[0].data.toString("hex")).toBe("01020304");
  });

  it("reports render failures without leaking provider details", async () => {
    process.env.JSON2VIDEO_API_KEY = "test-json2video-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          movie: { status: "error", message: "The source image could not be loaded." },
        }),
      ),
    );

    const result = await json2videoAdapter.poll("AbCdEfGhIjKlMnOp");
    expect(result).toEqual({
      status: "failed",
      error: "The source image could not be loaded.",
    });
  });

  it("requires the server key and does not call the network without it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      json2videoAdapter.create(
        request({ model: getModel(MODEL_CONFIG.json2video)!, aspectRatio: "16:9" }),
      ),
    ).rejects.toThrow(/JSON2VIDEO_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly when reference images are supplied", async () => {
    process.env.JSON2VIDEO_API_KEY = "test-json2video-key";
    const result = await json2videoAdapter.create(
      request({
        model: getModel(MODEL_CONFIG.json2video)!,
        aspectRatio: "16:9",
        images: [
          { data: Buffer.from("fake"), mimeType: "image/png", role: "reference" },
        ],
      }),
    );
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("Expected failure");
    expect(result.error).toMatch(/does not accept reference images/i);
  });

  it("treats cancellation as local because JSON2Video cannot stop a render", async () => {
    await expect(json2videoAdapter.cancel("AbCdEfGhIjKlMnOp")).resolves.toBeUndefined();
  });
});
