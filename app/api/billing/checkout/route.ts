import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { createCheckout } from "@/lib/billing/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { billingCheckoutSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `billing-checkout:${user.id}`, limit: 12, windowMs: 60_000 });
    const input = billingCheckoutSchema.parse(await readJson(request));
    const result = await createCheckout(user, input);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
