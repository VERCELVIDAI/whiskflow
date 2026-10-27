import { describe, expect, it } from "vitest";
import { errorResponse } from "@/lib/errors";

describe("errorResponse", () => {
  it("returns an actionable 503 for database setup failures", async () => {
    const error = new Error("Supabase Auth is configured but DATABASE_URL is missing.");
    error.name = "DatabaseUnavailableError";

    const response = errorResponse(error);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "database_unavailable",
        message: "Supabase Auth is configured but DATABASE_URL is missing.",
      },
    });
  });

  it("does not leak unknown errors", async () => {
    const response = errorResponse(new Error("secret internal detail"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "internal_error" },
    });
  });
});
