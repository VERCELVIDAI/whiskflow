import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  billingMode,
  constructStripeEvent,
  verifyStripeSignature,
} from "@/lib/billing/stripe";
import {
  cancelSubscription,
  createCheckout,
  fulfillOrder,
  getBillingSummary,
  handleStripeEvent,
} from "@/lib/billing/service";
import {
  CREDIT_PACKS,
  PLANS,
  annualSavingsCents,
  creditPackById,
  formatUsd,
  monthlyEquivalentCents,
  paidPlanById,
  planPriceCents,
} from "@/lib/billing/plans";
import { billingCheckoutSchema } from "@/lib/validation";
import type { AppUser } from "@/lib/types";
import {
  createTestProfile,
  getProfileBalance,
  setupTestDatabase,
  teardownTestDatabase,
  testDatabase,
} from "./helpers/db";

function appUser(profile: { id: string; email: string; fullName: string }): AppUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    avatarUrl: null,
    plan: "free",
    credits: 0,
    reservedCredits: 0,
    createdAt: new Date().toISOString(),
    authMode: "local",
  };
}

async function subscriptionOrder(
  ownerId: string,
  input: {
    planId?: string;
    credits?: number;
    amountCents?: number;
    interval?: "month" | "year";
    provider?: "stripe" | "demo";
  } = {},
): Promise<string> {
  const id = randomUUID();
  await testDatabase().query(
    `INSERT INTO billing_orders
       (id, owner_id, kind, plan_id, credits, amount_cents, currency, billing_interval,
        status, provider, idempotency_key)
     VALUES ($1, $2, 'subscription', $3, $4, $5, 'usd', $6, 'pending', $7, $8)`,
    [
      id,
      ownerId,
      input.planId ?? "creator",
      input.credits ?? 4000,
      input.amountCents ?? 1900,
      input.interval ?? "month",
      input.provider ?? "stripe",
      `test-order-${id}`,
    ],
  );
  return id;
}

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

describe("billing catalog", () => {
  it("uses whole-dollar, server-owned prices and annual pricing at ten months", () => {
    for (const plan of PLANS.filter((item) => item.id !== "free")) {
      expect(plan.monthlyPriceCents).toBeGreaterThan(0);
      expect(plan.annualPriceCents).toBe(plan.monthlyPriceCents * 10);
      expect(plan.monthlyCredits).toBeGreaterThan(0);
      expect(annualSavingsCents(plan)).toBe(plan.monthlyPriceCents * 2);
      expect(monthlyEquivalentCents(plan, "year")).toBe(
        Math.round((plan.monthlyPriceCents * 10) / 12),
      );
      expect(planPriceCents(plan, "year")).toBe(plan.annualPriceCents);
    }
    expect(paidPlanById("free")).toBeNull();
    expect(paidPlanById("creator")?.name).toBe("Creator");
    expect(paidPlanById("not-a-plan")).toBeNull();
  });

  it("keeps credit packs priced on the server and formatted for display", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.priceCents).toBeGreaterThan(0);
      expect(creditPackById(pack.id)).toEqual(pack);
    }
    expect(formatUsd(1900)).toBe("$19");
    expect(formatUsd(1583)).toBe("$15.83");
    expect(creditPackById("missing-pack")).toBeNull();
  });

  it("strips any client-supplied amount from checkout input", () => {
    const parsed = billingCheckoutSchema.parse({
      kind: "subscription",
      planId: "creator",
      interval: "year",
      amountCents: 1,
      credits: 999_999,
    });
    expect(parsed).toMatchObject({ kind: "subscription", planId: "creator", interval: "year" });
    expect(parsed).not.toHaveProperty("amountCents");
    expect(parsed).not.toHaveProperty("credits");
  });
});

describe("billing mode detection", () => {
  it("uses demo billing only for a local workspace with no Stripe keys", () => {
    expect(billingMode()).toBe("demo");
    try {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
      expect(billingMode()).toBe("unconfigured");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_example");
      expect(billingMode()).toBe("stripe");
    } finally {
      vi.unstubAllEnvs();
    }
    expect(billingMode()).toBe("demo");
  });
});

describe("demo checkout", () => {
  it("upgrades the plan, grants monthly credits and records a paid demo order", async () => {
    const owner = await createTestProfile({ credits: 100, plan: "free" });
    const result = await createCheckout(appUser(owner), {
      kind: "subscription",
      planId: "creator",
      interval: "month",
      idempotencyKey: randomUUID(),
    });

    expect(result).toMatchObject({ mode: "demo", demo: true });
    expect(result.url).toContain("checkout=success");

    const summary = await getBillingSummary(owner.id);
    expect(summary.mode).toBe("demo");
    expect(summary.planId).toBe("creator");
    expect(summary.planName).toBe("Creator");
    expect(summary.subscription).toMatchObject({
      planId: "creator",
      interval: "month",
      status: "active",
      provider: "demo",
    });
    expect(summary.orders[0]).toMatchObject({
      kind: "subscription",
      planId: "creator",
      credits: 4000,
      amountCents: 1900,
      status: "paid",
      provider: "demo",
    });

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4100, reserved: 0 });
    const ledger = await testDatabase().query(
      `SELECT type, amount, description, metadata FROM credit_transactions WHERE owner_id = $1`,
      [owner.id],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "grant", amount: 4000 });
    expect(ledger[0].metadata).toMatchObject({ source: "billing", kind: "subscription" });
  });

  it("does not grant twice when the same idempotency key is retried", async () => {
    const owner = await createTestProfile({ credits: 100, plan: "free" });
    const key = randomUUID();
    const first = await createCheckout(appUser(owner), {
      kind: "subscription",
      planId: "creator",
      interval: "month",
      idempotencyKey: key,
    });
    const second = await createCheckout(appUser(owner), {
      kind: "subscription",
      planId: "creator",
      interval: "month",
      idempotencyKey: key,
    });

    expect(second.orderId).toBe(first.orderId);
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4100, reserved: 0 });
    const orders = await testDatabase().query(
      `SELECT id FROM billing_orders WHERE owner_id = $1`,
      [owner.id],
    );
    expect(orders).toHaveLength(1);
  });

  it("adds a credit pack without changing the plan", async () => {
    const owner = await createTestProfile({ credits: 50, plan: "free" });
    await createCheckout(appUser(owner), {
      kind: "credits",
      packId: "topup-1000",
      idempotencyKey: randomUUID(),
    });

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 1050, reserved: 0 });
    const summary = await getBillingSummary(owner.id);
    expect(summary.planId).toBe("free");
    expect(summary.subscription).toBeNull();
    expect(summary.orders[0]).toMatchObject({
      kind: "credits",
      credits: 1000,
      amountCents: 1000,
      status: "paid",
    });
  });

  it("charges the catalog annual price even if the client sends a smaller amount", async () => {
    const owner = await createTestProfile({ credits: 0, plan: "free" });
    const parsed = billingCheckoutSchema.parse({
      kind: "subscription",
      planId: "creator",
      interval: "year",
      amountCents: 1,
      idempotencyKey: randomUUID(),
    });
    await createCheckout(appUser(owner), parsed);

    const summary = await getBillingSummary(owner.id);
    expect(summary.orders[0]).toMatchObject({
      amountCents: 19000,
      credits: 4000,
      interval: "year",
    });
  });

  it("switches plans and grants only the difference in monthly credits", async () => {
    const owner = await createTestProfile({ credits: 0, plan: "free" });
    await createCheckout(appUser(owner), {
      kind: "subscription",
      planId: "creator",
      interval: "month",
      idempotencyKey: randomUUID(),
    });
    await createCheckout(appUser(owner), {
      kind: "subscription",
      planId: "studio",
      interval: "month",
      idempotencyKey: randomUUID(),
    });

    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 12000, reserved: 0 });
    const summary = await getBillingSummary(owner.id);
    expect(summary.planId).toBe("studio");
    expect(summary.subscription).toMatchObject({ planId: "studio", status: "active" });
    expect(summary.orders[0]).toMatchObject({ planId: "studio", credits: 8000, status: "paid" });
  });

  it("cancels a demo plan immediately while keeping granted credits", async () => {
    const owner = await createTestProfile({ credits: 100, plan: "free" });
    await createCheckout(appUser(owner), {
      kind: "subscription",
      planId: "creator",
      interval: "month",
      idempotencyKey: randomUUID(),
    });
    const summary = await cancelSubscription(owner.id);

    expect(summary.planId).toBe("free");
    expect(summary.subscription).toMatchObject({ planId: "creator", status: "cancelled" });
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4100, reserved: 0 });
  });
});

describe("stripe webhook verification and fulfilment", () => {
  it("verifies fresh signatures and rejects tampering or stale timestamps", () => {
    const payload = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test" } },
    });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const header = `t=${timestamp},v1=${signature}`;

    expect(verifyStripeSignature(payload, header, secret)).toBe(true);
    expect(verifyStripeSignature(`${payload} `, header, secret)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${timestamp - 1000},v1=${signature}`, secret)).toBe(
      false,
    );
    expect(verifyStripeSignature(payload, null, secret)).toBe(false);
    expect(constructStripeEvent(payload, header, secret)).toMatchObject({
      id: "evt_test",
      type: "checkout.session.completed",
    });
    expect(() => constructStripeEvent(payload, "t=1,v1=bad", secret)).toThrowError(
      /signature is invalid/i,
    );
  });

  it("fulfils a Stripe checkout once and ignores duplicate webhook events", async () => {
    const owner = await createTestProfile({ credits: 0, plan: "free" });
    const orderId = await subscriptionOrder(owner.id);
    const eventId = `evt_${randomUUID()}`;
    const event = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { orderId },
          payment_status: "paid",
          customer: "cus_test",
          payment_intent: "pi_test",
        },
      },
    };

    await expect(handleStripeEvent(event)).resolves.toEqual({ handled: true, duplicate: false });
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4000, reserved: 0 });

    const summary = await getBillingSummary(owner.id);
    expect(summary.planId).toBe("creator");
    expect(summary.subscription).toMatchObject({ status: "active", provider: "stripe" });
    expect(summary.orders[0]).toMatchObject({
      status: "paid",
      provider: "stripe",
      amountCents: 1900,
    });

    await expect(handleStripeEvent(event)).resolves.toEqual({ handled: false, duplicate: true });
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4000, reserved: 0 });
  });

  it("grants renewal credits for a paid invoice exactly once", async () => {
    const owner = await createTestProfile({ credits: 0, plan: "creator" });
    const subscriptionId = `sub_${randomUUID()}`;
    await testDatabase().query(
      `INSERT INTO billing_subscriptions
         (id, owner_id, plan_id, billing_interval, status, provider,
          provider_subscription_id, provider_customer_id, current_period_end)
       VALUES ($1, $2, 'creator', 'month', 'active', 'stripe', $3, 'cus_test', NOW())`,
      [randomUUID(), owner.id, subscriptionId],
    );

    const invoiceId = `in_${randomUUID()}`;
    const periodEnd = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    const event = {
      id: `evt_${randomUUID()}`,
      type: "invoice.paid",
      data: {
        object: {
          id: invoiceId,
          subscription: subscriptionId,
          billing_reason: "subscription_cycle",
          amount_paid: 1900,
          currency: "usd",
          customer: "cus_test",
          period_end: periodEnd,
        },
      },
    };

    await handleStripeEvent(event);
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4000, reserved: 0 });
    const orders = await testDatabase().query(
      `SELECT amount_cents, credits, status, provider FROM billing_orders WHERE owner_id = $1`,
      [owner.id],
    );
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      amount_cents: 1900,
      credits: 4000,
      status: "paid",
      provider: "stripe",
    });

    await handleStripeEvent(event);
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 4000, reserved: 0 });
  });

  it("marks a pending order paid only through an idempotent fulfil call", async () => {
    const owner = await createTestProfile({ credits: 10, plan: "free" });
    const orderId = await subscriptionOrder(owner.id, { credits: 12000, planId: "studio" });
    const first = await fulfillOrder({
      orderId,
      provider: "stripe",
      providerCustomerId: "cus_fulfil",
    });
    const second = await fulfillOrder({
      orderId,
      provider: "stripe",
      providerCustomerId: "cus_fulfil",
    });

    expect(first.alreadyFulfilled).toBe(false);
    expect(second.alreadyFulfilled).toBe(true);
    await expect(getProfileBalance(owner.id)).resolves.toEqual({ credits: 12010, reserved: 0 });
  });
});
