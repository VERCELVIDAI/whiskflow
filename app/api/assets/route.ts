import { booleanParam, intParam, searchParam } from "@/lib/api";
import { errorResponse, AppError } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { listAssets } from "@/lib/data/assets";
import type { AssetKind } from "@/lib/types";

const KINDS = new Set(["image", "video", "audio"]);

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const kind = searchParam(request, "kind");
    if (kind && !KINDS.has(kind)) {
      throw new AppError(422, "invalid_kind", "Choose a valid media type.");
    }
    const sort = searchParam(request, "sort");
    const result = await listAssets(user.id, {
      page: intParam(request, "page", 1),
      pageSize: intParam(request, "pageSize", 24),
      search: searchParam(request, "search") ?? "",
      kind: kind as AssetKind | undefined,
      folder: searchParam(request, "folder"),
      favorites: booleanParam(request, "favorites"),
      trash: booleanParam(request, "trash"),
      projectId: searchParam(request, "projectId"),
      sort: sort === "oldest" || sort === "title" ? sort : "newest",
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
