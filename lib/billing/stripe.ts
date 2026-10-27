import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError, logWarning } from "@/lib/errors";
import { isRemoteDatabaseConfigured, isSupabaseConfigured } from "@/lib/db";
import type { BillingMode } from "@/lib/types";

const STRIPE_API = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface StripeCheckoutSession {
  id: string;
  object: "checkout.session";
  status: string | null;
  payment_status: string | null;
  customer: string | null;
  subscription: string | null;
  payment_intent: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  client_reference_id: string | null;
  url: string | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string | null;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
  metadata: Record<string, string> | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface StripeCheckoutInput {
  ownerId: string;
  email: string;
  customerId: string | null;
  orderId: string;
  kind: "subscription" | "credits";
  name: string;
  description: string;
  amountCents: number;
  currency: string;
  interval: "month" | "year" | null;
  credits: number;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Stripe is the live billing provider only when both halves of the integration
 * are present. Demo billing is deliberately limited to a local workspace so a
 * public deployment can never mint free credits.
 */
export function billingMode(): BillingMode {
  const secret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  if (secret && webhook) return "stripe";
  if (!secret && !webhook && !isRemoteDatabaseConfigured() && !isSupabaseConfigured()) {
    return "demo";
  }
  return "unconfigured";
}

export function stripeConfigured(): boolean {
  return billingMode() === "stripe";
}

function stripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new AppError(
      503,
      "billing_not_configured",
      "Stripe is not configured on this deployment. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
    );
  }
  return key;
}

async function stripeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${stripeSecretKey()}`,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      502,
      "billing_provider_unreachable",
      "Could not reach the billing provider. Please try again.",
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const stripeError = (payload as { error?: { message?: string; code?: string } } | null)?.error;
    logWarning("Stripe request failed", {
      path,
      status: response.status,
      code: stripeError?.code,
      message: stripeError?.message,
    });
    throw new AppError(
      502,
      "billing_provider_error",
      "The billing provider rejected this request. Please try again.",
    );
  }

  return payload as T;
}

export async function createCheckoutSession(
  input: StripeCheckoutInput,
): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams();
  body.set("mode", input.kind === "subscription" ? "subscription" : "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.ownerId);
  body.set("billing_address_collection", "auto");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", input.currency);
  body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  body.set("line_items[0][price_data][product_data][name]", input.name);
  body.set("line_items[0][price_data][product_data][description]", input.description);
  if (input.kind === "subscription" && input.interval) {
    body.set("line_items[0][price_data][recurring][interval]", input.interval);
    body.set("subscription_data[metadata][orderId]", input.orderId);
    body.set("subscription_data[metadata][ownerId]", input.ownerId);
    body.set("subscription_data[metadata][planId]", input.planId);
    body.set("subscription_data[metadata][interval]", input.interval);
  }
  body.set("metadata[orderId]", input.orderId);
  body.set("metadata[ownerId]", input.ownerId);
  body.set("metadata[kind]", input.kind);
  body.set("metadata[planId]", input.planId);
  body.set("metadata[credits]", String(input.credits));
  if (input.interval) body.set("metadata[interval]", input.interval);

  if (input.customerId) {
    body.set("customer", input.customerId);
  } else {
    body.set("customer_email", input.email);
  }

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function retrieveStripeSubscription(
  subscriptionId: string,
): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ id: string; url: string }> {
  const body = new URLSearchParams();
  body.set("customer", customerId);
  body.set("return_url", returnUrl);
  return stripeRequest<{ id: string; url: string }>("/billing_portal/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ cancel_at_period_end: "true" }).toString(),
  });
}

export async function resumeStripeSubscription(subscriptionId: string): Promise<void> {
  await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ cancel_at_period_end: "false" }).toString(),
  });
}

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Verify the `stripe-signature` header against the raw request body. The raw
 * body is required: parsing JSON first changes whitespace and invalidates HMACs.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  if (!signatureHeader || !secret) return false;

  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  return signatures.some((signature) => secureCompare(signature, expected));
}

export function constructStripeEvent(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): StripeEvent {
  if (!verifyStripeSignature(payload, signatureHeader, secret)) {
    throw new AppError(400, "invalid_signature", "The billing webhook signature is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new AppError(400, "invalid_payload", "The billing webhook body is invalid.");
  }

  const event = parsed as Partial<StripeEvent>;
  if (
    !event ||
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    !event.data ||
    typeof event.data.object !== "object" ||
    event.data.object === null
  ) {
    throw new AppError(400, "invalid_payload", "The billing webhook body is invalid.");
  }

  return event as StripeEvent;
}
