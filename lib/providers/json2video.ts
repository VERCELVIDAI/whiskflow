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

const BASE_URL = "https://api.json2video.com/v2";

interface MovieCreateResponse {
  success?: boolean;
  project?: string;
  message?: string;
}

interface MovieStatus {
  success?: boolean;
  status?: string;
  message?: string;
  url?: string | null;
  width?: number;
  height?: number;
  duration?: number;
}

interface MovieStatusResponse {
  success?: boolean;
  movie?: MovieStatus;
  message?: string;
}

function apiKey(): string {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) {
    throw new ProviderError(
      "json2video",
      "Whisk Flow 1.1 is not connected. Add JSON2VIDEO_API_KEY on the server.",
    );
  }
  return key;
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey(),
  };
}

interface Canvas {
  resolution: string;
  width: number;
  height: number;
}

function canvasFor(aspectRatio: string, resolution?: string): Canvas {
  const high = resolution !== "720p";
  switch (aspectRatio) {
    case "9:16":
      return high
        ? { resolution: "instagram-story", width: 1080, height: 1920 }
        : { resolution: "custom", width: 720, height: 1280 };
    case "1:1":
      return high
        ? { resolution: "squared", width: 1080, height: 1080 }
        : { resolution: "custom", width: 720, height: 720 };
    case "4:5":
      return high
        ? { resolution: "instagram-feed", width: 1080, height: 1350 }
        : { resolution: "custom", width: 720, height: 900 };
    default:
      return high
        ? { resolution: "full-hd", width: 1920, height: 1080 }
        : { resolution: "hd", width: 1280, height: 720 };
  }
}

function hashPrompt(prompt: string): number {
  let hash = 0;
  for (let index = 0; index < prompt.length; index += 1) {
    hash = (hash * 31 + prompt.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

const PALETTES = [
  {
    base: "#090b11",
    accentA: "rgba(138, 180, 248, 0.32)",
    accentB: "rgba(255, 176, 103, 0.18)",
    glow: "rgba(138, 180, 248, 0.16)",
  },
  {
    base: "#0b0909",
    accentA: "rgba(255, 154, 118, 0.24)",
    accentB: "rgba(120, 160, 255, 0.22)",
    glow: "rgba(255, 154, 118, 0.14)",
  },
  {
    base: "#080a0a",
    accentA: "rgba(168, 230, 207, 0.22)",
    accentB: "rgba(138, 180, 248, 0.24)",
    glow: "rgba(168, 230, 207, 0.12)",
  },
];

function paletteFor(seed: number) {
  return PALETTES[seed % PALETTES.length];
}

function backgroundHtml(seed: number): string {
  const palette = paletteFor(seed);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: ${palette.base}; }
  .stage {
    position: absolute; inset: 0;
    background:
      radial-gradient(1200px 820px at 14% 6%, ${palette.accentA}, transparent 64%),
      radial-gradient(1000px 760px at 88% 94%, ${palette.accentB}, transparent 62%),
      radial-gradient(800px 500px at 50% 50%, ${palette.glow}, transparent 72%),
      linear-gradient(135deg, #050506 0%, ${palette.base} 52%, #040405 100%);
  }
  .grain {
    position: absolute; inset: -40%; opacity: 0.15; transform: rotate(7deg);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.42'/%3E%3C/svg%3E");
    background-size: 180px 180px;
  }
  .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 42%, transparent 26%, rgba(0, 0, 0, 0.68) 100%);
  }
  .frame {
    position: absolute; inset: 3.4%;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .rule {
    position: absolute; left: 7%; right: 7%; top: 88%; height: 1px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
  }
</style>
</head>
<body>
  <div class="stage"></div>
  <div class="grain"></div>
  <div class="vignette"></div>
  <div class="frame"></div>
  <div class="rule"></div>
</body>
</html>`;
}

function splitPrompt(prompt: string): { title: string; body: string } {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (clean.length <= 96) return { title: clean, body: "" };
  const sentence = clean.search(/[.!?](\s|$)/);
  let cut = sentence > 40 && sentence < 100 ? sentence + 1 : 96;
  if (cut < clean.length) {
    const space = clean.lastIndexOf(" ", cut);
    if (space > 40) cut = space;
  }
  const title = `${clean
    .slice(0, cut)
    .trim()
    .replace(/[,;:.!?]+$/, "")}${cut < clean.length ? "…" : ""}`;
  const body = clean.slice(cut).trim().slice(0, 220);
  return { title, body };
}

function textElement(input: {
  text: string;
  x: string;
  y: string;
  width: string;
  height: string;
  settings: Record<string, string>;
  fadeIn?: number;
  fadeOut?: number;
}): Record<string, unknown> {
  return {
    type: "text",
    text: input.text,
    style: "001",
    position: "custom",
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    duration: -2,
    "fade-in": input.fadeIn ?? 1.2,
    "fade-out": input.fadeOut ?? 1.2,
    settings: input.settings,
  };
}

function moviePayload(request: ProviderGenerationRequest): Record<string, unknown> {
  const canvas = canvasFor(request.aspectRatio, request.resolution);
  const duration = request.durationSeconds || 10;
  const seed = request.seed ?? hashPrompt(request.prompt);
  const { title, body } = splitPrompt(request.prompt);
  const kickerSize = Math.round(canvas.width * 0.011);
  const titleSize = Math.round(canvas.width * 0.05);
  const bodySize = Math.round(canvas.width * 0.016);
  const footerSize = Math.round(canvas.width * 0.01);

  const elements: Record<string, unknown>[] = [
    textElement({
      text: "WHISK FLOW 1.1",
      x: "7%",
      y: "6%",
      width: "86%",
      height: "6%",
      fadeIn: 1.6,
      fadeOut: 1,
      settings: {
        "font-family": "Inter",
        "font-size": `${kickerSize}px`,
        "font-weight": "500",
        "letter-spacing": "0.32em",
        "text-transform": "uppercase",
        color: "rgba(255, 255, 255, 0.58)",
        "text-align": "center",
        "vertical-position": "center",
        "horizontal-position": "center",
        "text-shadow": "0 2px 24px rgba(0, 0, 0, 0.55)",
      },
    }),
    textElement({
      text: title,
      x: "7%",
      y: "26%",
      width: "86%",
      height: "36%",
      fadeIn: 1.4,
      fadeOut: 1.4,
      settings: {
        "font-family": "Playfair Display",
        "font-size": `${titleSize}px`,
        "font-weight": "500",
        "line-height": "1.06",
        "letter-spacing": "-0.02em",
        color: "#ffffff",
        "text-align": "left",
        "vertical-position": "center",
        "horizontal-position": "left",
        "text-shadow": "0 6px 48px rgba(0, 0, 0, 0.66)",
      },
    }),
  ];

  if (body) {
    elements.push(
      textElement({
        text: body,
        x: "7%",
        y: "65%",
        width: "80%",
        height: "18%",
        fadeIn: 1.6,
        fadeOut: 1.2,
        settings: {
          "font-family": "Inter",
          "font-size": `${bodySize}px`,
          "font-weight": "400",
          "line-height": "1.55",
          "letter-spacing": "0.01em",
          color: "rgba(255, 255, 255, 0.74)",
          "text-align": "left",
          "vertical-position": "top",
          "horizontal-position": "left",
          "text-shadow": "0 3px 30px rgba(0, 0, 0, 0.62)",
        },
      }),
    );
  }

  elements.push(
    textElement({
      text: "WHISK FLOW · AI FILM STUDIO",
      x: "7%",
      y: "90%",
      width: "86%",
      height: "5%",
      fadeIn: 1.8,
      fadeOut: 1,
      settings: {
        "font-family": "Inter",
        "font-size": `${footerSize}px`,
        "font-weight": "500",
        "letter-spacing": "0.24em",
        "text-transform": "uppercase",
        color: "rgba(255, 255, 255, 0.4)",
        "text-align": "center",
        "vertical-position": "center",
        "horizontal-position": "center",
        "text-shadow": "0 2px 20px rgba(0, 0, 0, 0.55)",
      },
    }),
  );

  return {
    resolution: canvas.resolution,
    ...(canvas.resolution === "custom" ? { width: canvas.width, height: canvas.height } : {}),
    quality: request.quality || "high",
    fps: 25,
    cache: false,
    "client-data": { app: "whisk-flow", model: request.model.id },
    scenes: [
      {
        duration,
        elements: [
          {
            type: "html",
            html: backgroundHtml(seed),
            position: "custom",
            x: 0,
            y: 0,
            width: "100%",
            height: "100%",
            duration: -2,
            pan: "right",
            "pan-distance": 0.05,
            "pan-crop": true,
            cache: false,
            wait: 1,
          },
        ],
      },
    ],
    elements,
  };
}

async function downloadRender(url: string): Promise<Buffer> {
  const response = await fetchWithPolicy("json2video", url, {
    method: "GET",
    timeoutMs: 120_000,
    retries: 1,
  });
  if (!response.ok) {
    throw new ProviderError(
      "json2video",
      "Whisk Flow 1.1 rendered the video but it could not be downloaded.",
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function safeMessage(movie: MovieStatus | undefined, fallback: string): string {
  const message = movie?.message?.trim();
  if (message && message.length <= 500) return message;
  return fallback;
}

export const json2videoAdapter: ProviderAdapter = {
  async create(request: ProviderGenerationRequest): Promise<ProviderCreateResult> {
    if (request.model.kind !== "video") {
      return {
        status: "failed",
        error: "Whisk Flow 1.1 renders video only. Choose an image model for stills.",
      };
    }
    if (request.images.length > 0) {
      return {
        status: "failed",
        error:
          "Whisk Flow 1.1 currently renders text-led motion graphics and does not accept reference images.",
      };
    }

    const response = await fetchWithPolicy("json2video", `${BASE_URL}/movies`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(moviePayload(request)),
      timeoutMs: 60_000,
      retries: 1,
    });
    const payload = await readJsonResponse<MovieCreateResponse>("json2video", response);
    if (!payload.success || !payload.project) {
      return {
        status: "failed",
        error: payload.message || "Whisk Flow 1.1 could not start the render.",
      };
    }
    return { status: "running", providerJobId: payload.project };
  },

  async poll(providerJobId: string): Promise<ProviderPollResult> {
    const response = await fetchWithPolicy(
      "json2video",
      `${BASE_URL}/movies?project=${encodeURIComponent(providerJobId)}&format=simple`,
      { method: "GET", headers: headers(), timeoutMs: 30_000, retries: 2 },
    );
    const payload = await readJsonResponse<MovieStatusResponse>("json2video", response);
    const movie = payload.movie;
    if (!payload.success || !movie) {
      return {
        status: "failed",
        error: payload.message || "Whisk Flow 1.1 returned an unreadable render status.",
      };
    }
    switch (movie.status) {
      case "done": {
        if (!movie.url) {
          return {
            status: "failed",
            error: "Whisk Flow 1.1 finished without returning a video file.",
          };
        }
        const data = await downloadRender(movie.url);
        const asset: ProviderOutputAsset = {
          data,
          mimeType: "video/mp4",
          width: movie.width,
          height: movie.height,
          durationSeconds: movie.duration,
        };
        return { status: "succeeded", assets: [asset] };
      }
      case "error":
        return {
          status: "failed",
          error: safeMessage(movie, "Whisk Flow 1.1 could not render this movie."),
        };
      case "timeout":
        return {
          status: "failed",
          error: "Whisk Flow 1.1 timed out while rendering this movie.",
        };
      case "pending":
      case "running":
        return { status: "running" };
      default:
        return {
          status: "failed",
          error: "Whisk Flow 1.1 returned an unknown render status.",
        };
    }
  },

  async cancel(): Promise<void> {
    // JSON2Video cannot cancel a render once it has started. The local job is
    // cancelled and its credits are released; the remote render may still finish.
  },
};
