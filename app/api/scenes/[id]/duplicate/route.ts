import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { duplicateScene } from "@/lib/data/scenes";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const scene = await duplicateScene(user.id, id);
    return Response.json({ scene }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
