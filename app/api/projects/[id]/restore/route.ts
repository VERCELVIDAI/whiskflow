import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { restoreProject } from "@/lib/data/projects";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const project = await restoreProject(user.id, id);
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
