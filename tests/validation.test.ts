import { describe, expect, it } from "vitest";
import {
  assetListQuerySchema,
  assetUpdateSchema,
  emailSchema,
  generationRequestSchema,
  loginSchema,
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
  registerSchema,
  resetPasswordSchema,
  sceneCreateSchema,
  sceneReorderSchema,
  sceneUpdateSchema,
} from "@/lib/validation";

describe("account validation", () => {
  it("normalizes email addresses", () => {
    expect(emailSchema.parse("  DIRECTOR@Studio.Example  ")).toBe("director@studio.example");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("enforces password strength", () => {
    const valid = registerSchema.parse({
      fullName: "Demo Director",
      email: "demo@example.com",
      password: "strong-pass-1",
    });
    expect(valid.password).toBe("strong-pass-1");
    expect(
      registerSchema.safeParse({
        fullName: "Demo Director",
        email: "demo@example.com",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        fullName: "Demo Director",
        email: "demo@example.com",
        password: "letters-only",
      }).success,
    ).toBe(false);
  });

  it("rejects empty logins and short reset tokens", () => {
    expect(loginSchema.safeParse({ email: "demo@example.com", password: "" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "short", password: "strong-pass-1" }).success).toBe(
      false,
    );
  });
});

describe("project and scene validation", () => {
  it("applies sensible project defaults", () => {
    const project = projectCreateSchema.parse({ title: "A quiet film" });
    expect(project.mode).toBe("video");
    expect(project.aspectRatio).toBe("16:9");
    expect(project.description).toBe("");
    expect(project.settings).toEqual({});
  });

  it("limits scene batches and validates durations", () => {
    expect(
      projectCreateSchema.safeParse({
        title: "Too many scenes",
        scenes: Array.from({ length: 21 }, (_, index) => ({
          title: `Scene ${index + 1}`,
          prompt: "Prompt",
          durationSeconds: 4,
        })),
      }).success,
    ).toBe(false);

    expect(
      sceneCreateSchema.parse({ title: "Opening", prompt: "A wide shot" }).durationSeconds,
    ).toBe(4);
    expect(sceneUpdateSchema.safeParse({ durationSeconds: 0 }).success).toBe(false);
    expect(sceneUpdateSchema.safeParse({ durationSeconds: 21 }).success).toBe(false);
  });

  it("rejects unknown project fields instead of silently accepting them", () => {
    expect(projectUpdateSchema.safeParse({ title: "Fine" }).success).toBe(true);
    expect(projectUpdateSchema.safeParse({ title: "Fine", ownerId: "spoofed" }).success).toBe(false);
  });

  it("requires a complete scene order", () => {
    expect(sceneReorderSchema.safeParse({ sceneIds: [] }).success).toBe(false);
    expect(
      sceneReorderSchema.safeParse({ sceneIds: ["8e5c3b2a-1f4d-4e6a-9b8c-7d6e5f4a3b2c"] }).success,
    ).toBe(true);
  });
});

describe("generation validation", () => {
  it("requires a meaningful prompt and valid output count", () => {
    const base = {
      kind: "image",
      model: "gemini-nano-banana-2.1",
      prompt: "A lighthouse in fog",
      aspectRatio: "16:9",
    };
    expect(generationRequestSchema.parse(base).outputCount).toBe(1);
    expect(generationRequestSchema.safeParse({ ...base, prompt: "hi" }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...base, outputCount: 0 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...base, outputCount: 5 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...base, idempotencyKey: "short" }).success).toBe(
      false,
    );
  });

  it("allows optional scene and reference fields", () => {
    const parsed = generationRequestSchema.parse({
      kind: "video",
      model: "gemini-omni-1.1-flash",
      prompt: "A slow push through a rain-soaked street",
      aspectRatio: "16:9",
      durationSeconds: 10,
      resolution: "1080p",
      generateAudio: true,
      referenceAssetIds: [],
    });
    expect(parsed.generateAudio).toBe(true);
    expect(parsed.referenceAssetIds).toEqual([]);
  });
});

describe("query and asset validation", () => {
  it("parses boolean query strings without treating 'false' as true", () => {
    expect(assetListQuerySchema.parse({ favorites: "false" }).favorites).toBe(false);
    expect(assetListQuerySchema.parse({ favorites: "true" }).favorites).toBe(true);
    expect(assetListQuerySchema.parse({ favorites: "1" }).favorites).toBe(true);
    expect(assetListQuerySchema.parse({ favorites: "0" }).favorites).toBe(false);
    expect(assetListQuerySchema.parse({}).favorites).toBeUndefined();
    expect(projectListQuerySchema.parse({ trash: "false" }).trash).toBe(false);
    expect(projectListQuerySchema.parse({ trash: "1" }).trash).toBe(true);
  });

  it("applies list defaults and caps page sizes", () => {
    const parsed = assetListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(24);
    expect(parsed.sort).toBe("newest");
    expect(assetListQuerySchema.safeParse({ pageSize: 61 }).success).toBe(false);
  });

  it("rejects unknown asset fields and overlong tag lists", () => {
    expect(assetUpdateSchema.safeParse({ favorite: true }).success).toBe(true);
    expect(assetUpdateSchema.safeParse({ favorite: true, ownerId: "spoofed" }).success).toBe(false);
    expect(
      assetUpdateSchema.safeParse({ tags: Array.from({ length: 13 }, (_, i) => `tag-${i}`) })
        .success,
    ).toBe(false);
  });
});
