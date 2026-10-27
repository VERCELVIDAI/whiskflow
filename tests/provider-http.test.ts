import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractJsonObject,
  fetchWithPolicy,
  providerErrorFromResponse,
  readJsonResponse,
} from "@/lib/providers/http";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("provider HTTP policy", () => {
  it("maps rejected API keys to a safe, actionable message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "bad key" } }, 401)));
    const response = await fetchWithPolicy("google", "https://provider.test/generate", {
      method: "POST",
    });
    expect(response.status).toBe(401);
    await expect(readJsonResponse("google", response)).rejects.toMatchObject({
      name: "ProviderError",
      provider: "google",
      status: 502,
      message: "The provider API key was rejected. Update it in the server environment.",
    });
  });

  it("preserves rate-limit status for the UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: { message: "slow down" } }, 429)),
    );
    const response = await fetchWithPolicy("openai", "https://provider.test/generate");
    await expect(readJsonResponse("openai", response)).rejects.toMatchObject({
      status: 429,
      message: "The provider rate limit was reached. Wait a moment, then try again.",
    });
  });

  it("retries transient provider failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithPolicy("google", "https://provider.test/generate", {
      retries: 1,
    });
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports network failures and timeouts without leaking internals", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("network down"))));
    await expect(
      fetchWithPolicy("google", "https://provider.test/generate", { retries: 0 }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      message: "Could not reach the generation provider. Check your connection and try again.",
    });

    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(timeout)));
    await expect(fetchWithPolicy("openai", "https://provider.test/generate")).rejects.toMatchObject(
      {
        message: "The generation provider timed out. Please try again.",
      },
    );
  });

  it("uses a safe message when an error response is not JSON", async () => {
    const response = new Response("<html>bad gateway</html>", { status: 500 });
    const error = await providerErrorFromResponse("google", response);
    expect(error.message).toBe("The provider rejected the request (HTTP 500).");
    expect(error.status).toBe(502);
  });

  it("extracts JSON objects from fenced or embedded model text", () => {
    expect(extractJsonObject('```json\n{"prompt":"a shot"}\n```')).toEqual({ prompt: "a shot" });
    expect(extractJsonObject('Here is the result: {"prompt":"a shot"} thanks')).toEqual({
      prompt: "a shot",
    });
    expect(extractJsonObject("not json")).toBeNull();
    expect(extractJsonObject("[1,2,3]")).toBeNull();
  });
});
