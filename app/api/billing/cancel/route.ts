import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { cancelSubscription, resumeSubscription } from "@/lib/billing/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { billingSubscriptionActionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `billing-cancel:${user.id}`, limit: 10, windowMs: 60_000 });
    const input = billingSubscriptionActionSchema.parse(await readJson(request));
    const summary =
      input.action === "resume"
        ? await resumeSubscription(user.id)
        : await cancelSubscription(user.id);
    return Response.json({ ok: true, summary });
  } catch (error) {
    return errorResponse(error);
  }
}
