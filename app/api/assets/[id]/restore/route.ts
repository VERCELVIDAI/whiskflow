import { assertSameOrigin } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { restoreAsset } from "@/lib/data/assets";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const asset = await restoreAsset(user.id, id);
    return Response.json({ asset });
  } catch (error) {
    return errorResponse(error);
  }
}
