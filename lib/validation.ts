import { z } from "zod";
import { CREDIT_PACK_IDS, PAID_PLAN_IDS } from "@/lib/billing/plans";

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address.")
  .max(254)
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(200),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(80),
});

export const billingCheckoutSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("subscription"),
    planId: z.enum(PAID_PLAN_IDS),
    interval: z.enum(["month", "year"]).default("month"),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  }),
  z.object({
    kind: z.literal("credits"),
    packId: z
      .string()
      .trim()
      .refine((value) => CREDIT_PACK_IDS.includes(value), "Choose a valid credit pack."),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  }),
]);

export const billingSubscriptionActionSchema = z.object({
  action: z.enum(["cancel", "resume"]),
});

export const projectModeSchema = z.enum(["video", "image", "storyboard"]);

export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, "Add a project title.").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  mode: projectModeSchema.default("video"),
  aspectRatio: z.string().trim().min(1).max(20).default("16:9"),
  prompt: z.string().trim().max(4000).optional(),
  negativePrompt: z.string().trim().max(1000).optional(),
  templateSlug: z.string().trim().max(100).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  provider: z.string().trim().max(40).optional().nullable(),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  scenes: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        prompt: z.string().trim().max(4000),
        durationSeconds: z.coerce.number().int().min(1).max(20).default(4),
      }),
    )
    .max(20)
    .optional(),
});

export const projectUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Project title cannot be empty.").max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    mode: projectModeSchema.optional(),
    status: z.enum(["draft", "in_progress", "complete"]).optional(),
    aspectRatio: z.string().trim().min(1).max(20).optional(),
    provider: z.string().trim().max(40).nullable().optional(),
    model: z.string().trim().max(120).nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    promptHistory: z.array(z.string().max(4000)).max(100).optional(),
    coverAssetId: z.string().uuid().nullable().optional(),
    favorite: z.boolean().optional(),
  })
  .strict();

export const sceneCreateSchema = z.object({
  title: z.string().trim().min(1, "Add a scene title.").max(120).default("New scene"),
  prompt: z.string().trim().max(4000).optional().default(""),
  negativePrompt: z.string().trim().max(1000).optional().default(""),
  durationSeconds: z.coerce.number().int().min(1).max(20).optional().default(4),
  transition: z.enum(["cut", "fade", "dissolve"]).optional().default("cut"),
  referenceAssetIds: z.array(z.string().uuid()).max(8).optional().default([]),
});

export const sceneUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    prompt: z.string().trim().max(4000).optional(),
    negativePrompt: z.string().trim().max(1000).optional(),
    durationSeconds: z.coerce.number().int().min(1).max(20).optional(),
    transition: z.enum(["cut", "fade", "dissolve"]).optional(),
    referenceAssetIds: z.array(z.string().uuid()).max(8).optional(),
    firstFrameAssetId: z.string().uuid().nullable().optional(),
    lastFrameAssetId: z.string().uuid().nullable().optional(),
    thumbnailUrl: z.string().max(2000).nullable().optional(),
    videoAssetId: z.string().uuid().nullable().optional(),
    generationJobId: z.string().uuid().nullable().optional(),
    status: z.enum(["draft", "queued", "generating", "ready", "failed"]).optional(),
    error: z.string().max(1000).nullable().optional(),
    orderIndex: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const sceneReorderSchema = z.object({
  sceneIds: z.array(z.string().uuid()).min(1).max(100),
});

export const assetUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    favorite: z.boolean().optional(),
    folder: z.string().trim().min(1).max(60).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
    projectId: z.string().uuid().nullable().optional(),
    sceneId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const generationRequestSchema = z.object({
  kind: z.enum(["image", "video"]),
  model: z.string().trim().min(1, "Choose a model.").max(120),
  prompt: z.string().trim().min(3, "Describe what you want to create.").max(4000),
  negativePrompt: z.string().trim().max(1000).optional().default(""),
  aspectRatio: z.string().trim().min(1).max(20),
  durationSeconds: z.coerce.number().int().min(1).max(20).optional(),
  resolution: z.string().trim().max(20).optional(),
  outputCount: z.coerce.number().int().min(1).max(4).optional().default(1),
  quality: z.enum(["low", "medium", "high"]).optional(),
  stylePreset: z.string().trim().max(80).optional(),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional().nullable(),
  generateAudio: z.boolean().optional(),
  projectId: z.string().uuid().optional().nullable(),
  sceneId: z.string().uuid().optional().nullable(),
  referenceAssetIds: z.array(z.string().uuid()).max(8).optional().default([]),
  firstFrameAssetId: z.string().uuid().optional().nullable(),
  lastFrameAssetId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const promptAssistantSchema = z.object({
  prompt: z.string().trim().min(2, "Add an idea first.").max(4000),
  action: z.enum([
    "enhance",
    "cinematic",
    "realistic",
    "camera",
    "variations",
    "simplify",
    "translate",
  ]),
  mode: z.enum(["image", "video"]).default("video"),
  targetLanguage: z.string().trim().max(40).optional().default("English"),
});

export const exportRequestSchema = z.object({
  format: z.enum(["json"]).default("json"),
});

// URLSearchParams values are strings. z.coerce.boolean() would turn "false"
// into true, so parse the common query encodings explicitly.
const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return value === "1" || value === "true";
}, z.boolean().optional());

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(24),
  search: z.string().trim().max(120).optional().default(""),
  mode: z.enum(["video", "image", "storyboard"]).optional(),
  favorites: booleanQuerySchema,
  trash: booleanQuerySchema,
});

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(24),
  search: z.string().trim().max(120).optional().default(""),
  kind: z.enum(["image", "video", "audio"]).optional(),
  folder: z.string().trim().max(60).optional(),
  favorites: booleanQuerySchema,
  trash: booleanQuerySchema,
  projectId: z.string().uuid().optional(),
  sort: z.enum(["newest", "oldest", "title"]).optional().default("newest"),
});

export type GenerationRequestInput = z.infer<typeof generationRequestSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;
export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>;
