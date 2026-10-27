import { z } from "zod";
import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse, AppError, UnauthorizedError } from "@/lib/errors";
import { passwordSchema } from "@/lib/validation";
import { authMode, requireApiUser } from "@/lib/auth";
import { changeLocalPassword } from "@/lib/auth/local";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { supabaseAuthErrorMessage } from "@/lib/auth/supabase-errors";

const schema = z.object({
  currentPassword: z.string().max(128).optional().default(""),
  newPassword: passwordSchema,
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    if (authMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new UnauthorizedError();

      const input = schema.parse(await readJson(request));
      const { error } = await supabase.auth.updateUser({ password: input.newPassword });
      if (error) {
        throw new AppError(
          400,
          error.code ?? "password_change_failed",
          supabaseAuthErrorMessage(error, "reset"),
        );
      }
      return Response.json({ ok: true });
    }

    const user = await requireApiUser();
    const input = schema.parse(await readJson(request));
    await changeLocalPassword(user.id, input.currentPassword, input.newPassword);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
