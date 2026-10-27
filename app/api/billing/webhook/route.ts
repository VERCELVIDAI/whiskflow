import { constructStripeEvent } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/service";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhooks. The raw body must be read before any JSON parsing so the
 * `stripe-signature` HMAC can be verified byte-for-byte.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return Response.json(
        {
          error: {
            code: "billing_not_configured",
            message: "The Stripe webhook secret is not configured.",
          },
        },
        { status: 503 },
      );
    }

    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    const event = constructStripeEvent(payload, signature, secret);
    const result = await handleStripeEvent(event);
    return Response.json({ received: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
