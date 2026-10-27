import { afterEach, describe, expect, it, vi } from "vitest";
import { runPromptAssistant } from "@/lib/prompt-assistant";

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("prompt assistant local fallback", () => {
  it("labels the local fallback honestly when no language model is connected", async () => {
    const result = await runPromptAssistant({
      prompt: "A cyclist crossing a rainy bridge",
      action: "enhance",
      mode: "video",
    });
    expect(result.source).toBe("local");
    expect(result.provider).toBeNull();
    expect(result.model).toBeNull();
    expect(result.note).toMatch(/Local enhance fallback/);
    expect(result.text).toMatch(/Camera:/);
    expect(result.text).toMatch(/Lighting:/);
    expect(result.text).toMatch(/Audio:/);
  });

  it("produces three distinct numbered variations", async () => {
    const result = await runPromptAssistant({
      prompt: "A ceramic studio at dawn",
      action: "variations",
      mode: "image",
    });
    const lines = result.text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^1\./);
    expect(lines[1]).toMatch(/^2\./);
    expect(lines[2]).toMatch(/^3\./);
  });

  it("simplifies to the first sentence", async () => {
    const result = await runPromptAssistant({
      prompt: "A lone tree on a hill. The wind moves through dry grass. A storm approaches.",
      action: "simplify",
      mode: "image",
    });
    expect(result.text).toBe("A lone tree on a hill.");
  });

  it("keeps the source text for the local translate fallback", async () => {
    const result = await runPromptAssistant({
      prompt: "Une rue sous la pluie",
      action: "translate",
      mode: "image",
      targetLanguage: "English",
    });
    expect(result.source).toBe("local");
    expect(result.text).toBe("Une rue sous la pluie");
  });
});

describe("prompt assistant provider dispatch", () => {
  it("uses the configured provider when it succeeds", async () => {
    process.env.GEMINI_API_KEY = "test-google-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [{ type: "text", text: "```text\nA provider prompt.\n```" }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await runPromptAssistant({
      prompt: "A quiet street",
      action: "cinematic",
      mode: "video",
    });
    expect(result.source).toBe("provider");
    expect(result.provider).toBe("google");
    expect(result.text).toBe("A provider prompt.");
    expect(result.note).toMatch(/Cinematic by Gemini/);
  });

  it("falls back locally when the provider rejects the request", async () => {
    process.env.GEMINI_API_KEY = "test-google-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "provider down" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await runPromptAssistant({
      prompt: "A quiet street",
      action: "realistic",
      mode: "image",
    });
    expect(result.source).toBe("local");
    expect(result.note).toMatch(/Provider unavailable/);
    expect(result.text).toMatch(/Natural skin texture/);
  });
});
