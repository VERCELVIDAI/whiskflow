import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { exportProject } from "@/lib/data/projects";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const result = await exportProject(user.id, id);
    return Response.json({
      record: result.record,
      export: {
        app: "Whisk Flow",
        version: 1,
        exportedAt: new Date().toISOString(),
        project: result.project,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
