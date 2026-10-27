import { assertSameOrigin, readJson } from "@/lib/api";
import { errorResponse, logInfo, logWarning } from "@/lib/errors";
import { forgotPasswordSchema } from "@/lib/validation";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { authMode } from "@/lib/auth";
import { createLocalPasswordReset } from "@/lib/auth/local";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { appUrl } from "@/lib/config";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit({ key: clientKey(request, "forgot"), limit: 5, windowMs: 60_000 });
    const input = forgotPasswordSchema.parse(await readJson(request));

    if (authMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
        redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
      });
      if (error) {
        logWarning("Supabase password reset email failed", {
          code: error.code,
          message: error.message,
        });
      }
      return Response.json({
        ok: true,
        delivery: "email",
        message: "If an account exists for that email, a reset link is on its way.",
      });
    }

    const reset = await createLocalPasswordReset(input.email);
    let resetUrl: string | undefined;
    if (reset.token) {
      resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(reset.token)}`;
      logInfo("Local password reset link generated", { email: input.email, resetUrl });
    }
    return Response.json({
      ok: true,
      delivery: "server-log",
      message:
        "Local mode does not send email. If an account exists for that address, its reset link was written to the server log.",
      resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
