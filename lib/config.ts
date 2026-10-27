export const APP_NAME = "Whisk Flow";
export const APP_TAGLINE = "Shape the story. Direct the frame.";

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export const DEFAULT_CREDITS = 1200;
export const DEMO_EMAIL = "demo@whiskflow.studio";
export const DEMO_PASSWORD = "demo-flow";

export const MAX_IMAGE_UPLOAD_BYTES =
  Number(process.env.MAX_IMAGE_UPLOAD_MB || 15) * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES =
  Number(process.env.MAX_VIDEO_UPLOAD_MB || 100) * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const STYLE_PRESETS = [
  { id: "cinematic", label: "Cinematic", suffix: "cinematic lighting, anamorphic lens, film grain, rich contrast" },
  { id: "editorial", label: "Editorial", suffix: "editorial photography, softbox lighting, magazine composition" },
  { id: "documentary", label: "Documentary", suffix: "documentary realism, natural light, candid framing" },
  { id: "anime", label: "Anime", suffix: "hand-painted anime key visual, expressive color, detailed linework" },
  { id: "claymation", label: "Claymation", suffix: "stop-motion claymation, tactile texture, miniature set design" },
  { id: "product", label: "Product", suffix: "premium product photography, clean backdrop, precise highlights" },
  { id: "noir", label: "Neo-noir", suffix: "neo-noir atmosphere, deep shadows, neon rim light" },
  { id: "dream", label: "Dreamlike", suffix: "dreamlike haze, pastel gradients, soft diffusion" },
] as const;

export const PROJECT_MODES = [
  { id: "video", label: "Video", description: "Generate cinematic clips from a prompt or stills." },
  { id: "image", label: "Image", description: "Create stills, key art and reference-ready frames." },
  { id: "storyboard", label: "Storyboard", description: "Shape a sequence scene by scene." },
] as const;

export const FOLDERS = ["Unsorted", "Characters", "Locations", "Props", "Style frames", "Uploads"] as const;
