import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { cancelGenerationJob } from "@/lib/generation/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const job = await cancelGenerationJob(user.id, id);
    return Response.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
