import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { createScene } from "@/lib/data/scenes";
import { sceneCreateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const input = sceneCreateSchema.parse(await readJson(request));
    const scene = await createScene(user.id, id, input);
    return Response.json({ scene }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
