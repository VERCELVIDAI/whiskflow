import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { ensureDemoUser } from "@/lib/demo";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit({ key: clientKey(request, "demo"), limit: 6, windowMs: 60_000 });
    const user = await ensureDemoUser();
    return Response.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error);
  }
}
