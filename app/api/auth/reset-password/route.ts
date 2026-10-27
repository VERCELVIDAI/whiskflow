import { z } from "zod";
import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse, AppError, logWarning } from "@/lib/errors";
import { passwordSchema, resetPasswordSchema } from "@/lib/validation";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { authMode } from "@/lib/auth";
import { resetLocalPassword } from "@/lib/auth/local";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { supabaseAuthErrorMessage } from "@/lib/auth/supabase-errors";

const supabaseResetSchema = z.object({ password: passwordSchema });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit({ key: clientKey(request, "reset"), limit: 8, windowMs: 60_000 });
    const body = await readJson(request);

    if (authMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new AppError(401, "reset_session_required", "Open the reset link from your email first.");
      }
      const input = supabaseResetSchema.parse(body);
      const { error } = await supabase.auth.updateUser({ password: input.password });
      if (error) {
        logWarning("Supabase password reset failed", {
          code: error.code,
          message: error.message,
        });
        throw new AppError(400, error.code ?? "reset_failed", supabaseAuthErrorMessage(error, "reset"));
      }
      // End the temporary recovery session so the user signs in with the new
      // password and the success state is visible on /login.
      await supabase.auth.signOut();
      return Response.json({ ok: true });
    }

    const input = resetPasswordSchema.parse(body);
    await resetLocalPassword(input.token, input.password);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
