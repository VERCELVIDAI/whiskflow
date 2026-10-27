import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { reorderScenes } from "@/lib/data/scenes";
import { sceneReorderSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const input = sceneReorderSchema.parse(await readJson(request));
    const scenes = await reorderScenes(user.id, id, input.sceneIds);
    return Response.json({ scenes });
  } catch (error) {
    return errorResponse(error);
  }
}
