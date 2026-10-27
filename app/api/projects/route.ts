import { assertSameOrigin, booleanParam, intParam, readJson, searchParam } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/data/projects";
import { projectCreateSchema, projectModeSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const mode = searchParam(request, "mode");
    const result = await listProjects(user.id, {
      page: intParam(request, "page", 1),
      pageSize: intParam(request, "pageSize", 24),
      search: searchParam(request, "search") ?? "",
      mode: mode ? projectModeSchema.parse(mode) : undefined,
      favorites: booleanParam(request, "favorites"),
      trash: booleanParam(request, "trash"),
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `project-create:${user.id}`, limit: 30, windowMs: 60_000 });
    const input = projectCreateSchema.parse(await readJson(request));
    const project = await createProject(user.id, input);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
