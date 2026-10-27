import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { deleteScene, updateScene } from "@/lib/data/scenes";
import { sceneUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const input = sceneUpdateSchema.parse(await readJson(request));
    const scene = await updateScene(user.id, id, input);
    return Response.json({ scene });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    await deleteScene(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
