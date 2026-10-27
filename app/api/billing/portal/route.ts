import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { createPortalSessionForUser } from "@/lib/billing/service";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `billing-portal:${user.id}`, limit: 6, windowMs: 60_000 });
    const session = await createPortalSessionForUser(user.id);
    return Response.json(session);
  } catch (error) {
    return errorResponse(error);
  }
}
