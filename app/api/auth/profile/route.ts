import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/validation";
import { requireApiUser, updateProfileForUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = updateProfileSchema.parse(await readJson(request));
    const updated = await updateProfileForUser(user, input);
    return Response.json({ ok: true, user: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
