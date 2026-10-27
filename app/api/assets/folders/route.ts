import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { listAssetFolders } from "@/lib/data/assets";

export async function GET() {
  try {
    const user = await requireApiUser();
    const folders = await listAssetFolders(user.id);
    return Response.json({ folders });
  } catch (error) {
    return errorResponse(error);
  }
}
