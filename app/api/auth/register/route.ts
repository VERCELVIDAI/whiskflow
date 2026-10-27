import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse, AppError, logWarning } from "@/lib/errors";
import { registerSchema } from "@/lib/validation";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { authMode } from "@/lib/auth";
import { registerLocal } from "@/lib/auth/local";
import { assertSupabaseDatabaseConfigured, createSupabaseServerClient } from "@/lib/auth/supabase";
import { supabaseAuthErrorMessage } from "@/lib/auth/supabase-errors";
import { appUrl } from "@/lib/config";
import { seedWelcomeContent } from "@/lib/demo";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit({ key: clientKey(request, "register"), limit: 8, windowMs: 60_000 });
    const input = registerSchema.parse(await readJson(request));

    if (authMode() === "supabase") {
      assertSupabaseDatabaseConfigured();
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.fullName },
          emailRedirectTo: `${appUrl()}/auth/callback?next=/`,
        },
      });
      if (error) {
        logWarning("Supabase sign-up failed", {
          code: error.code,
          message: error.message,
        });
        const code = error.code ?? "signup_failed";
        const status = code === "user_already_exists" || code === "email_exists" ? 409 : 400;
        throw new AppError(status, code, supabaseAuthErrorMessage(error, "register"));
      }
      if (data.session && data.user) {
        await seedWelcomeContent(data.user.id);
      }
      return Response.json({
        ok: true,
        requiresVerification: !data.session,
        message: data.session
          ? "Your studio is ready."
          : "Check your inbox to verify your email, then sign in.",
      });
    }

    const user = await registerLocal(input);
    await seedWelcomeContent(user.id);
    return Response.json({ ok: true, requiresVerification: false, user });
  } catch (error) {
    return errorResponse(error);
  }
}
