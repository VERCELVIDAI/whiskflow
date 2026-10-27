import type { TemplateScene } from "@/lib/types";

export interface ExampleProject {
  title: string;
  description: string;
  mode: "video" | "image" | "storyboard";
  aspectRatio: string;
  poster: string;
  templateSlug: string;
  scenes: TemplateScene[];
  favorite?: boolean;
  status: "draft" | "in_progress" | "complete";
  video?: string;
}

/**
 * Example projects shown to every new account. These are clearly labelled as
 * examples and never presented as provider output.
 */
export const WELCOME_PROJECTS: ExampleProject[] = [
  {
    title: "The Last Light",
    description: "Example project — a quiet roadside story. Replace the prompts with your own.",
    mode: "video",
    aspectRatio: "16:9",
    poster: "/samples/cinematic-diner.jpg",
    templateSlug: "example-last-light",
    favorite: true,
    status: "in_progress",
    scenes: [
      {
        title: "Arrival",
        prompt:
          "Wide shot of a solitary diner on an empty desert highway at dusk, neon sign flickering, slow dolly forward, anamorphic flares.",
        durationSeconds: 10,
      },
      {
        title: "The counter",
        prompt:
          "Medium close-up inside the diner, a lone figure stirs coffee, warm practicals, rain on the window, shallow depth of field.",
        durationSeconds: 10,
      },
      {
        title: "Last light",
        prompt:
          "Exterior wide shot, the diner lights switch off one by one, the last orange band of sunset disappears, ambient wind.",
        durationSeconds: 10,
      },
    ],
  },
  {
    title: "Saffron & Smoke",
    description: "Example project — a tactile food study built around steam and warm light.",
    mode: "image",
    aspectRatio: "4:5",
    poster: "/samples/food-pasta.jpg",
    templateSlug: "example-saffron",
    status: "draft",
    scenes: [
      {
        title: "Copper pot",
        prompt:
          "Macro food photography, handmade pasta lifted from a copper pot, saffron steam curling through a beam of warm light, embers behind.",
        durationSeconds: 10,
      },
      {
        title: "The table",
        prompt:
          "Overhead table scene, linen napkin, scattered saffron threads, dark ceramic bowl, single warm window light, quiet luxury.",
        durationSeconds: 10,
      },
    ],
  },
];

/**
 * Extra examples included in the demo account, including a playable sample
 * clip that makes the storyboard and player experience explorable offline.
 */
export const DEMO_PROJECTS: ExampleProject[] = [
  {
    title: "Bloom Study",
    description: "Example project — a motion study with a playable sample clip.",
    mode: "storyboard",
    aspectRatio: "16:9",
    poster: "/samples/hero-studio.jpg",
    templateSlug: "example-bloom",
    status: "complete",
    video: "/samples/demo-flower.mp4",
    favorite: true,
    scenes: [
      {
        title: "First bloom",
        prompt:
          "Macro time-lapse of a flower opening in soft studio light, dew catching a warm rim light, slow deliberate motion.",
        durationSeconds: 10,
      },
      {
        title: "Drift",
        prompt:
          "The flower sways gently against a charcoal backdrop, shallow depth of field, dust motes in a single beam of light.",
        durationSeconds: 10,
      },
    ],
  },
  {
    title: "Neon Runner",
    description: "Example project — anime key art energy for a rain-soaked chase.",
    mode: "video",
    aspectRatio: "9:16",
    poster: "/samples/anime-neon.jpg",
    templateSlug: "example-neon",
    status: "in_progress",
    scenes: [
      {
        title: "The alley",
        prompt:
          "Anime key visual of a courier sprinting through a neon-drenched alley at night, rain streaks, magenta and cyan light, low angle.",
        durationSeconds: 10,
      },
      {
        title: "Rooftop",
        prompt:
          "Wide anime shot of the courier leaping between rooftops, city below in electric haze, speed lines, hand-painted background.",
        durationSeconds: 10,
      },
    ],
  },
];
