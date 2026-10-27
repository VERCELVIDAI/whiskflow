import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { generationRequestSchema } from "@/lib/validation";
import { startGeneration } from "@/lib/generation/service";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `generate:${user.id}`, limit: 12, windowMs: 60_000 });
    const input = generationRequestSchema.parse(await readJson(request));
    const result = await startGeneration(user.id, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
