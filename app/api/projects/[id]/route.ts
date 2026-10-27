import { assertSameOrigin, booleanParam, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import {
  getProject,
  permanentlyDeleteProject,
  softDeleteProject,
  updateProject,
} from "@/lib/data/projects";
import { projectUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const project = await getProject(user.id, id);
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const input = projectUpdateSchema.parse(await readJson(request));
    const project = await updateProject(user.id, id, input);
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    if (booleanParam(request, "permanent")) {
      await permanentlyDeleteProject(user.id, id);
    } else {
      await softDeleteProject(user.id, id);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
