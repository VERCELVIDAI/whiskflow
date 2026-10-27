import "server-only";
import { randomUUID } from "node:crypto";
import { appUrl } from "@/lib/config";
import { getDatabase, type DbClient } from "@/lib/db";
import { grantCreditsTx } from "@/lib/data/credits";
import { AppError, ForbiddenError, NotFoundError, logWarning } from "@/lib/errors";
import { formatCredits } from "@/lib/utils";
import {
  billingMode,
  cancelStripeSubscription,
  createBillingPortalSession,
  createCheckoutSession,
  resumeStripeSubscription,
  retrieveCheckoutSession,
  retrieveStripeSubscription,
  type StripeCheckoutSession,
  type StripeEvent,
  type StripeSubscription,
} from "@/lib/billing/stripe";
import {
  creditPackById,
  isBillingInterval,
  paidPlanById,
  planById,
  planLabel,
  planPriceCents,
  type BillingInterval,
  type PaidPlanId,
} from "@/lib/billing/plans";
import type {
  AppUser,
  BillingCheckoutResult,
  BillingOrder,
  BillingOrderStatus,
  BillingSubscription,
  BillingSubscriptionStatus,
  BillingSummary,
} from "@/lib/types";

type Row = Record<string, unknown>;

export type CheckoutRequest = {
  idempotencyKey?: string;
} & (
  | { kind: "subscription"; planId: string; interval: string }
  | { kind: "credits"; packId: string }
);

interface FulfillInput {
  orderId: string;
  provider: "stripe" | "demo";
  providerPaymentId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  periodEnd?: string | null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  return new Date().toISOString();
}

function nullableIso(value: unknown): string | null {
  return value == null ? null : iso(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(source: Row | null, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" && value ? value : null;
}

function getNumber(source: Row | null, key: string): number | null {
  const value = source?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function secondsToIso(value: unknown): string | null {
  const seconds = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function periodEndFor(interval: BillingInterval): string {
  const date = new Date();
  if (interval === "year") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function mapOrder(row: Row): BillingOrder {
  return {
    id: text(row.id),
    kind: (text(row.kind, "subscription") as BillingOrder["kind"]) ?? "subscription",
    planId: text(row.plan_id),
    credits: number(row.credits),
    amountCents: number(row.amount_cents),
    currency: text(row.currency, "usd"),
    interval:
      row.billing_interval === "month" || row.billing_interval === "year"
        ? row.billing_interval
        : null,
    status: (text(row.status, "pending") as BillingOrderStatus) ?? "pending",
    provider: text(row.provider, "demo") === "stripe" ? "stripe" : "demo",
    createdAt: iso(row.created_at),
    completedAt: nullableIso(row.completed_at),
  };
}

function mapSubscription(row: Row): BillingSubscription {
  return {
    id: text(row.id),
    planId: text(row.plan_id),
    interval: row.billing_interval === "year" ? "year" : "month",
    status: (text(row.status, "active") as BillingSubscriptionStatus) ?? "active",
    provider: text(row.provider, "demo") === "stripe" ? "stripe" : "demo",
    currentPeriodEnd: nullableIso(row.current_period_end),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function subscriptionStatus(value: string | null): BillingSubscriptionStatus {
  switch (value) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "incomplete";
  }
}

function unconfiguredMessage(): string {
  const secret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  if (secret && !webhook) {
    return "Stripe is connected but the webhook secret is missing. Add STRIPE_WEBHOOK_SECRET to enable checkout.";
  }
  if (!secret && webhook) {
    return "The Stripe webhook secret is set but STRIPE_SECRET_KEY is missing. Add it to enable checkout.";
  }
  return "Billing is not configured on this deployment. Add Stripe keys to enable checkout.";
}

function assertBillingAvailable(): "stripe" | "demo" {
  const mode = billingMode();
  if (mode === "unconfigured") {
    throw new AppError(503, "billing_not_configured", unconfiguredMessage());
  }
  return mode;
}

async function insertOrder(
  db: DbClient,
  input: {
    ownerId: string;
    kind: "subscription" | "credits";
    planId: string;
    credits: number;
    amountCents: number;
    interval: BillingInterval | null;
    provider: "stripe" | "demo";
    idempotencyKey: string;
  },
): Promise<BillingOrder> {
  const rows = await db.query(
    `INSERT INTO billing_orders
       (id, owner_id, kind, plan_id, credits, amount_cents, currency, billing_interval,
        status, provider, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'usd', $7, 'pending', $8, $9)
     RETURNING *`,
    [
      randomUUID(),
      input.ownerId,
      input.kind,
      input.planId,
      Math.max(0, Math.round(input.credits)),
      Math.max(0, Math.round(input.amountCents)),
      input.interval,
      input.provider,
      input.idempotencyKey,
    ],
  );
  return mapOrder(rows[0]);
}

async function findOrderByKey(
  db: DbClient,
  ownerId: string,
  idempotencyKey: string,
): Promise<Row | null> {
  const rows = await db.query(
    `SELECT * FROM billing_orders WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [ownerId, idempotencyKey],
  );
  return rows[0] ?? null;
}

async function existingOrderResult(order: Row): Promise<BillingCheckoutResult | null> {
  const orderId = text(order.id);
  if (order.status === "paid") {
    return {
      mode: text(order.provider) === "stripe" ? "stripe" : "demo",
      url: `/pricing?checkout=success&order=${orderId}`,
      orderId,
      demo: text(order.provider) !== "stripe",
    };
  }
  if (order.status === "pending" && order.provider === "stripe" && order.provider_session_id) {
    try {
      const session = await retrieveCheckoutSession(text(order.provider_session_id));
      if (session.status === "open" && session.url) {
        return { mode: "stripe", url: session.url, orderId, demo: false };
      }
      if (
        session.status === "complete" &&
        (session.payment_status === "paid" || session.payment_status === "no_payment_required")
      ) {
        await fulfillOrder({
          orderId,
          provider: "stripe",
          providerPaymentId: session.payment_intent ?? null,
          providerCustomerId: session.customer ?? null,
          providerSubscriptionId: session.subscription ?? null,
        });
        return { mode: "stripe", url: `/pricing?checkout=success&order=${orderId}`, orderId, demo: false };
      }
    } catch (error) {
      logWarning("Could not resume existing checkout", {
        orderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}

export async function getBillingSummary(ownerId: string): Promise<BillingSummary> {
  const db = await getDatabase();
  const [profileRows, subscriptionRows, orderRows] = await Promise.all([
    db.query(`SELECT plan, billing_customer_id FROM profiles WHERE id = $1 LIMIT 1`, [ownerId]),
    db.query(
      `SELECT * FROM billing_subscriptions
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [ownerId],
    ),
    db.query(
      `SELECT * FROM billing_orders
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [ownerId],
    ),
  ]);

  if (profileRows.length === 0) throw new NotFoundError("Profile not found.");
  const mode = billingMode();
  const planId = text(profileRows[0].plan, "free");
  const hasBillingCustomer =
    Boolean(profileRows[0].billing_customer_id) ||
    orderRows.some((row) => Boolean(row.provider_customer_id));

  return {
    mode,
    planId,
    planName: planLabel(planId),
    subscription: subscriptionRows[0] ? mapSubscription(subscriptionRows[0]) : null,
    orders: orderRows.map(mapOrder),
    hasBillingCustomer,
    portalAvailable: mode === "stripe" && hasBillingCustomer,
    demo: mode === "demo",
    configured: mode !== "unconfigured",
  };
}

export async function createCheckout(
  user: AppUser,
  input: CheckoutRequest,
): Promise<BillingCheckoutResult> {
  const mode = assertBillingAvailable();
  const db = await getDatabase();
  const profileRows = await db.query(
    `SELECT plan, billing_customer_id FROM profiles WHERE id = $1 LIMIT 1`,
    [user.id],
  );
  if (profileRows.length === 0) throw new NotFoundError("Profile not found.");
  const currentPlanId = text(profileRows[0].plan, "free");
  const customerId = nullableText(profileRows[0].billing_customer_id);
  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();

  if (input.idempotencyKey) {
    const existing = await findOrderByKey(db, user.id, idempotencyKey);
    if (existing) {
      const resumed = await existingOrderResult(existing);
      if (resumed) return resumed;
      throw new AppError(
        409,
        "checkout_pending",
        "A checkout for this request is already in progress. Finish or cancel it before trying again.",
      );
    }
  }

  if (input.kind === "subscription") {
    const plan = paidPlanById(input.planId);
    if (!plan) {
      throw new AppError(400, "invalid_plan", "Choose a paid plan to continue.");
    }
    const interval: BillingInterval = isBillingInterval(input.interval) ? input.interval : "month";

    const activeRows = await db.query(
      `SELECT * FROM billing_subscriptions
       WHERE owner_id = $1 AND status IN ('active', 'past_due')
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );
    const active = activeRows[0] ?? null;

    if (active && text(active.plan_id) === plan.id) {
      throw new AppError(409, "already_subscribed", `You are already on the ${plan.name} plan.`);
    }
    if (active && mode === "stripe") {
      throw new AppError(
        409,
        "manage_subscription",
        "You already have an active plan. Open Manage billing to change or cancel it.",
      );
    }
    if (active && text(active.provider) !== "demo") {
      throw new AppError(
        409,
        "manage_subscription",
        "You already have an active plan. Manage it from the billing portal.",
      );
    }

    if (mode === "demo" && active) {
      return changeDemoPlan({
        ownerId: user.id,
        currentPlanId,
        subscription: active,
        plan,
        interval,
        idempotencyKey,
        customerId,
      });
    }

    const order = await insertOrder(db, {
      ownerId: user.id,
      kind: "subscription",
      planId: plan.id,
      credits: plan.monthlyCredits,
      amountCents: planPriceCents(plan, interval),
      interval,
      provider: mode,
      idempotencyKey,
    });

    if (mode === "demo") {
      const demoCustomerId = customerId ?? `demo_cus_${user.id}`;
      const providerSubscriptionId = `demo_sub_${order.id}`;
      await fulfillOrder({
        orderId: order.id,
        provider: "demo",
        providerCustomerId: demoCustomerId,
        providerSubscriptionId,
        periodEnd: periodEndFor(interval),
      });
      return {
        mode: "demo",
        url: `/pricing?checkout=success&order=${order.id}`,
        orderId: order.id,
        demo: true,
      };
    }

    return startStripeCheckout({
      db,
      orderId: order.id,
      user,
      customerId,
      kind: "subscription",
      name: `${plan.name} plan`,
      description: `${formatCredits(plan.monthlyCredits)} credits per ${interval}. Cancel anytime.`,
      amountCents: planPriceCents(plan, interval),
      interval,
      credits: plan.monthlyCredits,
      planId: plan.id,
    });
  }

  const pack = creditPackById(input.packId);
  if (!pack) {
    throw new AppError(400, "invalid_pack", "Choose a credit pack to continue.");
  }

  const order = await insertOrder(db, {
    ownerId: user.id,
    kind: "credits",
    planId: "credits",
    credits: pack.credits,
    amountCents: pack.priceCents,
    interval: null,
    provider: mode,
    idempotencyKey,
  });

  if (mode === "demo") {
    await fulfillOrder({
      orderId: order.id,
      provider: "demo",
      providerCustomerId: customerId ?? `demo_cus_${user.id}`,
    });
    return {
      mode: "demo",
      url: `/pricing?checkout=success&order=${order.id}`,
      orderId: order.id,
      demo: true,
    };
  }

  return startStripeCheckout({
    db,
    orderId: order.id,
    user,
    customerId,
    kind: "credits",
    name: pack.name,
    description: `${formatCredits(pack.credits)} one-time credits. They never expire.`,
    amountCents: pack.priceCents,
    interval: null,
    credits: pack.credits,
    planId: "credits",
  });
}

async function startStripeCheckout(input: {
  db: DbClient;
  orderId: string;
  user: AppUser;
  customerId: string | null;
  kind: "subscription" | "credits";
  name: string;
  description: string;
  amountCents: number;
  interval: BillingInterval | null;
  credits: number;
  planId: string;
}): Promise<BillingCheckoutResult> {
  const successUrl = `${appUrl()}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl()}/pricing?checkout=cancelled`;

  try {
    const session = await createCheckoutSession({
      ownerId: input.user.id,
      email: input.user.email,
      customerId: input.customerId,
      orderId: input.orderId,
      kind: input.kind,
      name: input.name,
      description: input.description,
      amountCents: input.amountCents,
      currency: "usd",
      interval: input.interval,
      credits: input.credits,
      planId: input.planId,
      successUrl,
      cancelUrl,
    });
    if (!session.url) {
      throw new AppError(
        502,
        "billing_provider_error",
        "The billing provider did not return a checkout link. Please try again.",
      );
    }
    await input.db.query(
      `UPDATE billing_orders SET provider_session_id = $1 WHERE id = $2`,
      [session.id, input.orderId],
    );
    return {
      mode: "stripe",
      url: session.url,
      orderId: input.orderId,
      demo: false,
    };
  } catch (error) {
    await input.db.query(
      `UPDATE billing_orders SET status = 'failed' WHERE id = $1 AND status = 'pending'`,
      [input.orderId],
    );
    throw error;
  }
}

async function changeDemoPlan(input: {
  ownerId: string;
  currentPlanId: string;
  subscription: Row;
  plan: NonNullable<ReturnType<typeof paidPlanById>>;
  interval: BillingInterval;
  idempotencyKey: string;
  customerId: string | null;
}): Promise<BillingCheckoutResult> {
  const db = await getDatabase();
  const currentPlan = planById(input.currentPlanId);
  const creditDelta = Math.max(
    0,
    input.plan.monthlyCredits - (currentPlan?.monthlyCredits ?? 0),
  );
  const order = await insertOrder(db, {
    ownerId: input.ownerId,
    kind: "subscription",
    planId: input.plan.id,
    credits: creditDelta,
    amountCents: planPriceCents(input.plan, input.interval),
    interval: input.interval,
    provider: "demo",
    idempotencyKey: input.idempotencyKey,
  });

  const customerId =
    input.customerId ?? nullableText(input.subscription.provider_customer_id);

  await db.transaction(async (tx) => {
    const orderRows = await tx.query(
      `SELECT * FROM billing_orders WHERE id = $1 FOR UPDATE`,
      [order.id],
    );
    if (orderRows.length === 0) throw new NotFoundError("Order not found.");
    if (orderRows[0].status === "paid") return;

    await tx.query(
      `UPDATE billing_orders
       SET status = 'paid', provider = 'demo', provider_customer_id = $2, completed_at = NOW()
       WHERE id = $1`,
      [order.id, customerId],
    );
    await tx.query(
      `UPDATE profiles
       SET plan = $2, billing_customer_id = COALESCE(billing_customer_id, $3), updated_at = NOW()
       WHERE id = $1`,
      [input.ownerId, input.plan.id, customerId],
    );
    await tx.query(
      `UPDATE billing_subscriptions
       SET plan_id = $2, billing_interval = $3, status = 'active',
           current_period_end = $4, cancel_at_period_end = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [
        text(input.subscription.id),
        input.plan.id,
        input.interval,
        periodEndFor(input.interval),
      ],
    );
    if (creditDelta > 0) {
      await grantCreditsTx(tx, {
        ownerId: input.ownerId,
        amount: creditDelta,
        description: `${input.plan.name} plan — ${formatCredits(creditDelta)} additional credits`,
        metadata: {
          source: "billing",
          orderId: order.id,
          provider: "demo",
          kind: "plan_change",
          planId: input.plan.id,
        },
      });
    }
  });

  return {
    mode: "demo",
    url: `/pricing?checkout=success&order=${order.id}`,
    orderId: order.id,
    demo: true,
  };
}

export async function fulfillOrder(
  input: FulfillInput,
): Promise<{ order: BillingOrder; alreadyFulfilled: boolean }> {
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT * FROM billing_orders WHERE id = $1 FOR UPDATE`,
      [input.orderId],
    );
    if (rows.length === 0) throw new NotFoundError("Order not found.");
    const order = rows[0];
    if (order.status === "paid") {
      return { order: mapOrder(order), alreadyFulfilled: true };
    }
    if (order.status !== "pending") {
      throw new AppError(409, "order_not_payable", "This order can no longer be completed.");
    }

    const ownerId = text(order.owner_id);
    const kind = text(order.kind, "subscription");
    const credits = number(order.credits);
    const planId = text(order.plan_id);
    const provider = input.provider;
    const interval: BillingInterval =
      order.billing_interval === "year" ? "year" : "month";
    const customerId = input.providerCustomerId ?? null;
    const paymentId = input.providerPaymentId ?? null;

    await tx.query(
      `UPDATE billing_orders
       SET status = 'paid', provider = $2, provider_payment_id = $3,
           provider_customer_id = COALESCE($4, provider_customer_id),
           completed_at = NOW()
       WHERE id = $1`,
      [input.orderId, provider, paymentId, customerId],
    );

    if (kind === "subscription") {
      await tx.query(
        `UPDATE profiles
         SET plan = $2, billing_customer_id = COALESCE($3, billing_customer_id), updated_at = NOW()
         WHERE id = $1`,
        [ownerId, planId, customerId],
      );

      const providerSubscriptionId =
        input.providerSubscriptionId ?? `local_sub_${input.orderId}`;
      const existing = await tx.query(
        `SELECT id FROM billing_subscriptions WHERE provider_subscription_id = $1 LIMIT 1`,
        [providerSubscriptionId],
      );
      if (existing.length > 0) {
        await tx.query(
          `UPDATE billing_subscriptions
           SET plan_id = $2, billing_interval = $3, status = 'active',
               provider_customer_id = COALESCE($4, provider_customer_id),
               current_period_end = COALESCE($5, current_period_end),
               cancel_at_period_end = FALSE, updated_at = NOW()
           WHERE provider_subscription_id = $1`,
          [
            providerSubscriptionId,
            planId,
            interval,
            customerId,
            input.periodEnd ?? periodEndFor(interval),
          ],
        );
      } else {
        await tx.query(
          `INSERT INTO billing_subscriptions
             (id, owner_id, plan_id, billing_interval, status, provider,
              provider_subscription_id, provider_customer_id, current_period_end)
           VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8)`,
          [
            randomUUID(),
            ownerId,
            planId,
            interval,
            provider,
            providerSubscriptionId,
            customerId,
            input.periodEnd ?? periodEndFor(interval),
          ],
        );
      }
    } else {
      await tx.query(
        `UPDATE profiles
         SET billing_customer_id = COALESCE($2, billing_customer_id), updated_at = NOW()
         WHERE id = $1`,
        [ownerId, customerId],
      );
    }

    if (credits > 0) {
      const description =
        kind === "subscription"
          ? `${planLabel(planId)} plan — ${formatCredits(credits)} credits`
          : `Credit pack — ${formatCredits(credits)} credits`;
      await grantCreditsTx(tx, {
        ownerId,
        amount: credits,
        description,
        metadata: {
          source: "billing",
          orderId: input.orderId,
          provider,
          kind,
          planId,
          amountCents: number(order.amount_cents),
        },
      });
    }

    const refreshed = await tx.query(`SELECT * FROM billing_orders WHERE id = $1`, [
      input.orderId,
    ]);
    return { order: mapOrder(refreshed[0]), alreadyFulfilled: false };
  });
}

async function markOrderCancelled(orderId: string): Promise<void> {
  const db = await getDatabase();
  await db.query(
    `UPDATE billing_orders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
    [orderId],
  );
}

async function syncStripeSubscription(subscriptionId: string): Promise<void> {
  let subscription: StripeSubscription;
  try {
    subscription = await retrieveStripeSubscription(subscriptionId);
  } catch (error) {
    logWarning("Could not refresh Stripe subscription", {
      subscriptionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM billing_subscriptions WHERE provider_subscription_id = $1 LIMIT 1`,
    [subscriptionId],
  );
  if (rows.length === 0) return;

  const status = subscriptionStatus(subscription.status);
  const metadata = asRecord(subscription.metadata);
  const metadataPlan = getString(metadata, "planId");
  const planId =
    metadataPlan && paidPlanById(metadataPlan) ? metadataPlan : text(rows[0].plan_id);
  const periodEnd = secondsToIso(subscription.current_period_end);

  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE billing_subscriptions
       SET plan_id = $2, status = $3, cancel_at_period_end = $4,
           current_period_end = COALESCE($5, current_period_end),
           provider_customer_id = COALESCE($6, provider_customer_id), updated_at = NOW()
       WHERE provider_subscription_id = $1`,
      [
        subscriptionId,
        planId,
        status,
        Boolean(subscription.cancel_at_period_end),
        periodEnd,
        subscription.customer,
      ],
    );
    if (status === "active") {
      await tx.query(`UPDATE profiles SET plan = $2, updated_at = NOW() WHERE id = $1`, [
        text(rows[0].owner_id),
        planId,
      ]);
    } else if (status === "cancelled") {
      await tx.query(`UPDATE profiles SET plan = 'free', updated_at = NOW() WHERE id = $1`, [
        text(rows[0].owner_id),
      ]);
    }
  });
}

export async function reconcileCheckoutSession(
  ownerId: string,
  sessionId: string,
): Promise<boolean> {
  if (billingMode() !== "stripe") return false;
  let session: StripeCheckoutSession;
  try {
    session = await retrieveCheckoutSession(sessionId);
  } catch (error) {
    logWarning("Could not reconcile checkout session", {
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }

  const metadata = asRecord(session.metadata);
  const metadataOwner = getString(metadata, "ownerId");
  if (session.client_reference_id !== ownerId && metadataOwner !== ownerId) {
    throw new ForbiddenError("This checkout session belongs to another account.");
  }

  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return false;
  }

  const orderId = getString(metadata, "orderId");
  if (orderId) {
    await fulfillOrder({
      orderId,
      provider: "stripe",
      providerPaymentId: session.payment_intent ?? null,
      providerCustomerId: session.customer ?? null,
      providerSubscriptionId: session.subscription ?? null,
    });
  }
  if (session.subscription) {
    await syncStripeSubscription(session.subscription);
  }
  return true;
}

async function handleInvoicePaid(eventId: string, invoice: Row): Promise<void> {
  const subscriptionId = getString(invoice, "subscription");
  if (!subscriptionId) return;

  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM billing_subscriptions WHERE provider_subscription_id = $1 LIMIT 1`,
    [subscriptionId],
  );
  if (rows.length === 0) return;
  const subscription = rows[0];
  const plan = planById(text(subscription.plan_id));
  if (!plan || plan.id === "free") return;

  const billingReason = getString(invoice, "billing_reason");
  const lines = asRecord(invoice.lines);
  const firstLine = Array.isArray(lines?.data) ? asRecord(lines.data[0]) : null;
  const periodEnd =
    secondsToIso(invoice.period_end) ?? secondsToIso(asRecord(firstLine?.period)?.end);
  const invoiceId = getString(invoice, "id") ?? eventId;

  if (billingReason === "subscription_create") {
    if (periodEnd) {
      await db.query(
        `UPDATE billing_subscriptions
         SET current_period_end = $2, status = 'active', updated_at = NOW()
         WHERE provider_subscription_id = $1`,
        [subscriptionId, periodEnd],
      );
    }
    return;
  }

  const amountPaid = getNumber(invoice, "amount_paid") ?? 0;
  const currency = getString(invoice, "currency") ?? "usd";
  const interval: BillingInterval =
    subscription.billing_interval === "year" ? "year" : "month";

  await db.transaction(async (tx) => {
    const locked = await tx.query(
      `SELECT * FROM billing_subscriptions WHERE provider_subscription_id = $1 FOR UPDATE`,
      [subscriptionId],
    );
    if (locked.length === 0) return;
    const ownerId = text(locked[0].owner_id);

    const inserted = await tx.query(
      `INSERT INTO billing_orders
         (id, owner_id, kind, plan_id, credits, amount_cents, currency, billing_interval,
          status, provider, provider_payment_id, provider_customer_id,
          idempotency_key, completed_at)
       VALUES ($1, $2, 'subscription', $3, $4, $5, $6, $7, 'paid', 'stripe', $8, $9, $10, NOW())
       ON CONFLICT (owner_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        ownerId,
        plan.id,
        plan.monthlyCredits,
        Math.max(0, Math.round(amountPaid)),
        currency,
        interval,
        invoiceId,
        getString(invoice, "customer"),
        `stripe-invoice:${invoiceId}`,
      ],
    );

    if (inserted.length > 0) {
      await grantCreditsTx(tx, {
        ownerId,
        amount: plan.monthlyCredits,
        description: `${plan.name} renewal — ${formatCredits(plan.monthlyCredits)} credits`,
        metadata: {
          source: "billing",
          provider: "stripe",
          kind: "renewal",
          planId: plan.id,
          invoiceId,
        },
      });
      await tx.query(`UPDATE profiles SET plan = $2, updated_at = NOW() WHERE id = $1`, [
        ownerId,
        plan.id,
      ]);
    }

    await tx.query(
      `UPDATE billing_subscriptions
       SET status = 'active', current_period_end = COALESCE($2, current_period_end), updated_at = NOW()
       WHERE provider_subscription_id = $1`,
      [subscriptionId, periodEnd],
    );
  });
}

async function handleSubscriptionChange(subscription: Row, deleted: boolean): Promise<void> {
  const subscriptionId = getString(subscription, "id");
  if (!subscriptionId) return;
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM billing_subscriptions WHERE provider_subscription_id = $1 LIMIT 1`,
    [subscriptionId],
  );
  if (rows.length === 0) return;
  const existing = rows[0];
  const metadata = asRecord(subscription.metadata);
  const metadataPlan = getString(metadata, "planId");
  const planId =
    metadataPlan && paidPlanById(metadataPlan)
      ? (metadataPlan as PaidPlanId)
      : text(existing.plan_id);
  const status = deleted ? "cancelled" : subscriptionStatus(getString(subscription, "status"));
  const periodEnd = secondsToIso(subscription.current_period_end);

  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE billing_subscriptions
       SET plan_id = $2, status = $3, cancel_at_period_end = $4,
           current_period_end = COALESCE($5, current_period_end),
           provider_customer_id = COALESCE($6, provider_customer_id), updated_at = NOW()
       WHERE provider_subscription_id = $1`,
      [
        subscriptionId,
        planId,
        status,
        deleted ? false : Boolean(subscription.cancel_at_period_end),
        periodEnd,
        getString(subscription, "customer"),
      ],
    );
    if (status === "active") {
      await tx.query(`UPDATE profiles SET plan = $2, updated_at = NOW() WHERE id = $1`, [
        text(existing.owner_id),
        planId,
      ]);
    } else if (status === "cancelled") {
      await tx.query(`UPDATE profiles SET plan = 'free', updated_at = NOW() WHERE id = $1`, [
        text(existing.owner_id),
      ]);
    }
  });
}

export async function handleStripeEvent(
  event: StripeEvent,
): Promise<{ handled: boolean; duplicate: boolean }> {
  const db = await getDatabase();
  const inserted = await db.query(
    `INSERT INTO billing_events (id, type) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [event.id, event.type],
  );
  if (inserted.length === 0) return { handled: false, duplicate: true };

  const object = event.data.object;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const metadata = asRecord(object.metadata);
        const orderId = getString(metadata, "orderId");
        const paymentStatus = getString(object, "payment_status");
        if (
          orderId &&
          (!paymentStatus || paymentStatus === "paid" || paymentStatus === "no_payment_required")
        ) {
          await fulfillOrder({
            orderId,
            provider: "stripe",
            providerPaymentId: getString(object, "payment_intent"),
            providerCustomerId: getString(object, "customer"),
            providerSubscriptionId: getString(object, "subscription"),
          });
          const subscriptionId = getString(object, "subscription");
          if (subscriptionId) await syncStripeSubscription(subscriptionId);
        }
        break;
      }
      case "checkout.session.expired": {
        const metadata = asRecord(object.metadata);
        const orderId = getString(metadata, "orderId");
        if (orderId) await markOrderCancelled(orderId);
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(event.id, object);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionChange(object, false);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(object, true);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Release the event id so Stripe can retry a failed delivery.
    await db.query(`DELETE FROM billing_events WHERE id = $1`, [event.id]);
    throw error;
  }

  return { handled: true, duplicate: false };
}

export async function cancelSubscription(ownerId: string): Promise<BillingSummary> {
  const mode = assertBillingAvailable();
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM billing_subscriptions
     WHERE owner_id = $1 AND status IN ('active', 'past_due')
     ORDER BY created_at DESC LIMIT 1`,
    [ownerId],
  );
  if (rows.length === 0) {
    throw new AppError(404, "no_subscription", "You do not have an active plan to cancel.");
  }
  const subscription = rows[0];

  if (mode === "demo") {
    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE billing_subscriptions
         SET status = 'cancelled', cancel_at_period_end = FALSE, updated_at = NOW()
         WHERE id = $1`,
        [text(subscription.id)],
      );
      await tx.query(`UPDATE profiles SET plan = 'free', updated_at = NOW() WHERE id = $1`, [
        ownerId,
      ]);
    });
    return getBillingSummary(ownerId);
  }

  const providerSubscriptionId = nullableText(subscription.provider_subscription_id);
  if (!providerSubscriptionId) {
    throw new AppError(400, "no_subscription", "This subscription cannot be cancelled online.");
  }
  await cancelStripeSubscription(providerSubscriptionId);
  await db.query(
    `UPDATE billing_subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [text(subscription.id)],
  );
  return getBillingSummary(ownerId);
}

export async function resumeSubscription(ownerId: string): Promise<BillingSummary> {
  if (billingMode() !== "stripe") {
    throw new AppError(
      400,
      "resume_unavailable",
      "Demo plans end immediately when cancelled. Choose a plan to start again.",
    );
  }
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT * FROM billing_subscriptions
     WHERE owner_id = $1 AND status = 'active' AND cancel_at_period_end = TRUE
     ORDER BY created_at DESC LIMIT 1`,
    [ownerId],
  );
  if (rows.length === 0) {
    throw new AppError(404, "no_subscription", "There is no cancelled plan to resume.");
  }
  const providerSubscriptionId = nullableText(rows[0].provider_subscription_id);
  if (!providerSubscriptionId) {
    throw new AppError(400, "resume_unavailable", "This subscription cannot be resumed online.");
  }
  await resumeStripeSubscription(providerSubscriptionId);
  await db.query(
    `UPDATE billing_subscriptions SET cancel_at_period_end = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [text(rows[0].id)],
  );
  return getBillingSummary(ownerId);
}

export async function createPortalSessionForUser(
  ownerId: string,
): Promise<{ url: string }> {
  if (billingMode() !== "stripe") {
    throw new AppError(
      400,
      "portal_unavailable",
      "The billing portal is available when Stripe is configured. Demo billing has no card portal.",
    );
  }
  const db = await getDatabase();
  const [profileRows, orderRows] = await Promise.all([
    db.query(`SELECT billing_customer_id FROM profiles WHERE id = $1 LIMIT 1`, [ownerId]),
    db.query(
      `SELECT provider_customer_id FROM billing_orders
       WHERE owner_id = $1 AND provider_customer_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [ownerId],
    ),
  ]);
  const customerId =
    nullableText(profileRows[0]?.billing_customer_id) ??
    nullableText(orderRows[0]?.provider_customer_id);
  if (!customerId) {
    throw new AppError(
      400,
      "no_billing_customer",
      "Make a purchase first, then you can manage billing here.",
    );
  }
  const session = await createBillingPortalSession(customerId, `${appUrl()}/pricing`);
  return { url: session.url };
}
