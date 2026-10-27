import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { logWarning } from "@/lib/errors";

function loginError(message: string, origin: string): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message.slice(0, 240));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (providerError) {
    return loginError(providerError, url.origin);
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "recovery" | "invite" | "email_change" | "email",
      });
      if (error) throw error;
    } else {
      throw new Error("The authentication link is missing its code.");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  } catch (error) {
    logWarning("Supabase auth callback failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return loginError("Could not complete sign-in. Try again.", url.origin);
  }
}
