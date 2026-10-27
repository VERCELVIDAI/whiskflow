import { describe, expect, it } from "vitest";
import { getTemplate, getTemplates } from "@/lib/templates";

describe("templates", () => {
  const templates = getTemplates();

  it("has unique slugs", () => {
    const slugs = templates.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("resolves every template by slug", () => {
    for (const template of templates) {
      expect(getTemplate(template.slug)?.title, template.slug).toBe(template.title);
    }
  });

  it("gives every video template a poster and an mp4 preview", () => {
    const videoTemplates = templates.filter((template) => template.video);
    expect(videoTemplates.length).toBeGreaterThanOrEqual(5);
    for (const template of videoTemplates) {
      expect(template.poster, template.slug).toMatch(/^\/samples\/.+\.(jpg|jpeg|png|webp)$/);
      expect(template.video, template.slug).toMatch(/^\/samples\/.+\.mp4$/);
      expect(template.mode, template.slug).toBe("video");
    }
  });

  it("keeps every aspect ratio in a colon-delimited width:height form", () => {
    for (const template of templates) {
      expect(template.aspectRatio, template.slug).toMatch(/^\d+:\d+$/);
    }
  });
});
