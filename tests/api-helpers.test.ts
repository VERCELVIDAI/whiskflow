import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSameOrigin,
  booleanParam,
  intParam,
  readJson,
  searchParam,
} from "@/lib/api";
import { AppError, errorResponse } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

afterEach(() => {
  vi.restoreAllMocks();
});

function request(url: string, headers: HeadersInit = {}): Request {
  return new Request(url, { headers });
}

describe("API request helpers", () => {
  it("accepts same-origin, server-side and app-origin requests", () => {
    expect(() =>
      assertSameOrigin(request("http://localhost:3000/api/projects")),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/projects", { origin: "http://localhost:3000" }),
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/projects", { origin: "http://127.0.0.1:3000" }),
      ),
    ).toThrow(AppError);
  });

  it("accepts an origin that matches the forwarded or host header", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/projects", {
          origin: "http://10.175.11.18:3000",
          host: "10.175.11.18:3000",
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/projects", {
          origin: "https://whisk.example",
          "x-forwarded-host": "whisk.example, proxy.internal",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).not.toThrow();
  });

  it("still rejects an origin that does not match the host header", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/projects", {
          origin: "https://evil.example",
          host: "10.175.11.18:3000",
        }),
      ),
    ).toThrow(expect.objectContaining({ status: 403, code: "invalid_origin" }));
  });

  it("rejects cross-origin and malformed origins", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/projects", { origin: "https://evil.example" }),
      ),
    ).toThrow(expect.objectContaining({ status: 403, code: "invalid_origin" }));

    expect(() =>
      assertSameOrigin(request("http://localhost:3000/api/projects", { origin: "not-a-url" })),
    ).toThrow(expect.objectContaining({ status: 403, code: "invalid_origin" }));
  });

  it("parses query parameters consistently", () => {
    const url = "http://localhost:3000/api/assets?page=3&search=frame&favorites=1&empty=";
    const req = request(url);
    expect(searchParam(req, "search")).toBe("frame");
    expect(searchParam(req, "missing")).toBeUndefined();
    expect(searchParam(req, "empty")).toBeUndefined();
    expect(booleanParam(req, "favorites")).toBe(true);
    expect(booleanParam(req, "missing")).toBe(false);
    expect(intParam(req, "page", 1)).toBe(3);
    expect(intParam(req, "missing", 7)).toBe(7);
    expect(intParam(req, "page", 7)).toBe(3);
    expect(intParam(request("http://localhost:3000/api?page=0"), "page", 7)).toBe(7);
  });

  it("returns a safe error for invalid JSON", async () => {
    await expect(readJson(new Request("http://localhost:3000/api/test", {
      method: "POST",
      body: "{not-json",
    }))).rejects.toMatchObject({ status: 400, code: "invalid_json" });
  });
});

describe("rate limiting", () => {
  it("blocks requests over the configured limit", () => {
    const key = `test-rate-${crypto.randomUUID()}`;
    expect(() => checkRateLimit({ key, limit: 2, windowMs: 60_000 })).not.toThrow();
    expect(() => checkRateLimit({ key, limit: 2, windowMs: 60_000 })).not.toThrow();
    expect(() => checkRateLimit({ key, limit: 2, windowMs: 60_000 })).toThrow(
      expect.objectContaining({ status: 429, code: "rate_limited" }),
    );
  });
});

describe("error responses", () => {
  it("maps Zod errors to a 422 with field details", async () => {
    const schema = z.object({ title: z.string().min(2) });
    try {
      schema.parse({ title: "" });
    } catch (error) {
      const response = errorResponse(error);
      expect(response.status).toBe(422);
      const payload = (await response.json()) as {
        error: { code: string; details: Array<{ path: string; message: string }> };
      };
      expect(payload.error.code).toBe("validation_error");
      expect(payload.error.details[0].path).toBe("title");
      return;
    }
    throw new Error("Expected Zod to reject the value.");
  });

  it("maps app errors and hides unexpected errors", async () => {
    const appResponse = errorResponse(new AppError(409, "conflict", "Already exists."));
    expect(appResponse.status).toBe(409);
    const appPayload = (await appResponse.json()) as { error: { code: string; message: string } };
    expect(appPayload.error).toMatchObject({ code: "conflict", message: "Already exists." });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unexpected = errorResponse(new Error("database password leaked"));
    expect(unexpected.status).toBe(500);
    const unexpectedPayload = (await unexpected.json()) as { error: { message: string } };
    expect(unexpectedPayload.error.message).toBe(
      "Something went wrong on our side. Please try again.",
    );
    expect(consoleSpy).toHaveBeenCalled();
  });
});
