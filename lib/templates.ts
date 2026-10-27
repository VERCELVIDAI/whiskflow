import type { Template } from "@/lib/types";

export const TEMPLATES: Template[] = [
  {
    slug: "last-light",
    title: "The Last Light",
    description: "A lonely roadside diner, a final conversation and a sky that refuses to go dark.",
    category: "Narrative",
    mode: "video",
    prompt:
      "A quiet roadside diner at blue hour, warm tungsten light spilling onto wet asphalt, a lone figure at the counter, slow push-in through rain-streaked glass, anamorphic flares, 35mm film grain, intimate and melancholic.",
    negativePrompt: "",
    aspectRatio: "16:9",
    durationSeconds: 10,
    stylePreset: "cinematic",
    poster: "/samples/cinematic-diner.jpg",
    featured: true,
    tags: ["Cinematic", "Night", "Narrative"],
    scenes: [
      {
        title: "Arrival",
        prompt:
          "Wide shot of a solitary diner on an empty desert highway at dusk, neon sign flickering, heat shimmer, slow dolly forward.",
        durationSeconds: 10,
      },
      {
        title: "The Counter",
        prompt:
          "Medium close-up inside the diner, a lone figure stirs coffee, warm practicals, rain on the window, shallow depth of field, quiet tension.",
        durationSeconds: 10,
      },
      {
        title: "Last light",
        prompt:
          "Exterior wide shot, the diner lights switch off one by one, the last orange band of sunset disappears, static camera, ambient wind.",
        durationSeconds: 10,
      },
    ],
  },
  {
    slug: "saffron-smoke",
    title: "Saffron & Smoke",
    description: "A tactile food film where steam, fire and color do the storytelling.",
    category: "Food",
    mode: "video",
    prompt:
      "Macro food cinematography, handmade pasta lifted from a copper pot, saffron steam curling through a beam of warm light, embers in the background, shallow focus, rich color, slow motion.",
    aspectRatio: "16:9",
    durationSeconds: 10,
    stylePreset: "cinematic",
    poster: "/samples/food-pasta.jpg",
    tags: ["Food", "Macro", "Warm"],
  },
  {
    slug: "neon-runner",
    title: "Neon Runner",
    description: "Anime key art energy for a rain-soaked chase through a future city.",
    category: "Anime",
    mode: "video",
    prompt:
      "Anime key visual of a courier sprinting through a neon-drenched alley at night, rain streaking through magenta and cyan light, dynamic low angle, speed lines, hand-painted background, cinematic composition.",
    aspectRatio: "9:16",
    durationSeconds: 10,
    stylePreset: "anime",
    poster: "/samples/anime-neon.jpg",
    featured: true,
    tags: ["Anime", "Neon", "Vertical"],
  },
  {
    slug: "desert-letter",
    title: "Desert Letter",
    description: "A sparse, sun-bleached character study on the edge of a dune.",
    category: "Portrait",
    mode: "image",
    prompt:
      "Editorial portrait of a traveler in a sand-colored linen coat standing on a vast dune, hard midday sun, wind lifting fabric, muted earth palette, medium format film look, quiet dignity.",
    aspectRatio: "3:4",
    stylePreset: "editorial",
    poster: "/samples/story-desert.jpg",
    tags: ["Editorial", "Desert", "Portrait"],
  },
  {
    slug: "form-01",
    title: "Form / 01",
    description: "A product study built from glass, shadow and a single confident highlight.",
    category: "Product",
    mode: "image",
    prompt:
      "Luxury perfume bottle on a polished stone plinth, single hard light source, deep amber glass, precise caustic shadows, minimal warm backdrop, high-end product photography, no text.",
    aspectRatio: "4:5",
    stylePreset: "product",
    poster: "/samples/product-perfume.jpg",
    featured: true,
    tags: ["Product", "Luxury", "Studio"],
  },
  {
    slug: "sneaker-launch",
    title: "Sneaker Launch",
    description: "A kinetic campaign frame for a footwear drop with a graphic point of view.",
    category: "Campaign",
    mode: "image",
    prompt:
      "A sculptural sneaker floating above a concrete plinth, electric blue gel lighting, crisp shadow, bold negative space for campaign copy, editorial product photography, hyper-detailed materials.",
    aspectRatio: "1:1",
    stylePreset: "product",
    poster: "/samples/brand-sneaker.jpg",
    tags: ["Campaign", "Product", "Graphic"],
  },
  {
    slug: "travel-diary",
    title: "Open Road",
    description: "A three-scene travel diary with a documentary heartbeat.",
    category: "Travel",
    mode: "storyboard",
    prompt:
      "A documentary travel sequence along an empty coastal road at golden hour, dust on the lens, honest color, human-scale moments.",
    aspectRatio: "16:9",
    durationSeconds: 10,
    stylePreset: "documentary",
    poster: "/samples/travel-road.jpg",
    tags: ["Travel", "Documentary", "Storyboard"],
    scenes: [
      {
        title: "Departure",
        prompt:
          "Handheld shot from the passenger seat, coastal road unfurling ahead, golden hour, wind in the microphone, lens flare.",
        durationSeconds: 10,
      },
      {
        title: "The stop",
        prompt:
          "Wide static shot of a car pulled onto a dusty shoulder, a figure walks toward the ocean, long shadows, natural sound.",
        durationSeconds: 10,
      },
      {
        title: "Afterglow",
        prompt:
          "Close-up of hands holding a paper map in warm evening light, ocean bokeh behind, subtle film grain, quiet closure.",
        durationSeconds: 10,
      },
    ],
  },
  {
    slug: "studio-session",
    title: "Studio Session",
    description: "Clean editorial light for a fashion story with room to breathe.",
    category: "Fashion",
    mode: "image",
    prompt:
      "Full-length fashion editorial in a warm concrete studio, oversized tailored silhouette, single softbox from the left, long shadow, muted neutral palette, medium format detail, confident stillness.",
    aspectRatio: "3:4",
    stylePreset: "editorial",
    poster: "/samples/fashion-editorial.jpg",
    tags: ["Fashion", "Editorial", "Studio"],
  },
  {
    slug: "dust-jump",
    title: "Dust Jump",
    description: "A deadpan stunt in a dry field: one chair, one SUV and a very close call.",
    category: "Stunt",
    mode: "video",
    prompt:
      "Vertical cinematic stunt shot in a dry golden-hour field, a man in sunglasses sits calmly in a folding chair as a dark SUV launches over him through a huge cloud of dust, slow motion, handheld camera, warm haze, practical action, deadpan comedy.",
    negativePrompt: "",
    aspectRatio: "9:16",
    durationSeconds: 10,
    stylePreset: "cinematic",
    poster: "/samples/templates/posters/dust-jump.jpg",
    video: "/samples/templates/dust-jump.mp4",
    featured: true,
    tags: ["Stunt", "Automotive", "Vertical"],
  },
  {
    slug: "cash-flow",
    title: "Cash Flow",
    description: "A creator flex shot with a fan of bills and a punch-in finish.",
    category: "Creator",
    mode: "video",
    prompt:
      "Vertical handheld social video, a young man in a black hoodie in a softly lit bedroom fans a thick stack of banknotes toward the camera, confident expression, natural window light, shallow depth of field, fast punch-in, high-energy creator content.",
    negativePrompt: "",
    aspectRatio: "9:16",
    durationSeconds: 10,
    stylePreset: "documentary",
    poster: "/samples/templates/posters/cash-flow.jpg",
    video: "/samples/templates/cash-flow.mp4",
    tags: ["Creator", "Social", "Vertical"],
  },
  {
    slug: "living-room-set",
    title: "Living Room Set",
    description: "A late-night apartment fashion clip with denim, city lights and playful energy.",
    category: "Fashion",
    mode: "video",
    prompt:
      "Vertical fashion clip, a woman in a fitted white tee and wide-leg light denim dances and poses in a modern apartment living room at night, floor-to-ceiling windows with city lights, static camera, soft interior lighting, playful confident energy, 3:4 framing.",
    negativePrompt: "",
    aspectRatio: "3:4",
    durationSeconds: 10,
    stylePreset: "editorial",
    poster: "/samples/templates/posters/living-room-set.jpg",
    video: "/samples/templates/living-room-set.mp4",
    tags: ["Fashion", "Denim", "Night"],
  },
  {
    slug: "gallery-tour",
    title: "Gallery Tour",
    description: "A minimal photo-gallery walkthrough with editorial imagery and a cursor-led flow.",
    category: "Product",
    mode: "video",
    prompt:
      "Screen-recorded product walkthrough of a minimal photo gallery app, a horizontal strip of moody editorial photos, a cursor selects a shot of a figure on a rooftop with birds, soft neutral interface, MINIMALISM CORPORATE typography, smooth UI motion, clean and premium.",
    negativePrompt: "",
    aspectRatio: "4:3",
    durationSeconds: 6,
    stylePreset: "product",
    poster: "/samples/templates/posters/gallery-tour.jpg",
    video: "/samples/templates/gallery-tour.mp4",
    tags: ["UI", "Product", "Minimal"],
  },
  {
    slug: "neon-nights",
    title: "Neon Nights",
    description: "A night-city montage cut to neon streaks, light trails and a denim close-up.",
    category: "Music",
    mode: "video",
    prompt:
      "Cinematic night montage, close-up of a woman in a denim jacket on a city street with rainbow neon reflections across her face, long-exposure light trails from passing traffic, a lone figure crouched in a neon-lit underpass, anamorphic flares, shallow depth of field, music-video energy.",
    negativePrompt: "",
    aspectRatio: "4:3",
    durationSeconds: 5,
    stylePreset: "cinematic",
    poster: "/samples/templates/posters/neon-nights.jpg",
    video: "/samples/templates/neon-nights.mp4",
    featured: true,
    tags: ["Neon", "Night", "Music Video"],
  },
];

export function getTemplates(): Template[] {
  return TEMPLATES;
}

export function getTemplate(slug: string): Template | undefined {
  return TEMPLATES.find((template) => template.slug === slug);
}
