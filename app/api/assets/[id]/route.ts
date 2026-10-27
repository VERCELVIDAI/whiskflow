import { assertSameOrigin, booleanParam, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import {
  getAsset,
  permanentlyDeleteAsset,
  softDeleteAsset,
  updateAsset,
} from "@/lib/data/assets";
import { assetUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const asset = await getAsset(user.id, id);
    return Response.json({ asset });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const input = assetUpdateSchema.parse(await readJson(request));
    const asset = await updateAsset(user.id, id, input);
    return Response.json({ asset });
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
      await permanentlyDeleteAsset(user.id, id);
    } else {
      await softDeleteAsset(user.id, id);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
