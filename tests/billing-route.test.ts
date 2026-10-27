import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireApiUser: async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    throw new UnauthorizedError();
  },
}));

import { GET } from "@/app/api/billing/route";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";

describe("billing route access", () => {
  it("rejects anonymous summary requests", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("requires a session before checkout validation runs", async () => {
    const response = await checkout(
      new Request("http://localhost:3000/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ kind: "subscription", planId: "creator", interval: "month" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("refuses webhooks when no signing secret is configured", async () => {
    const response = await webhook(
      new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=bad" },
      }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "billing_not_configured" },
    });
  });
});
