export type SupabaseAuthAction = "login" | "register" | "reset";

interface SupabaseAuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number;
}

const LOGIN_FALLBACK = "The email or password is incorrect.";
const REGISTER_FALLBACK = "We could not create your account. Please try again.";
const RESET_FALLBACK = "We could not update your password. Please try again.";

function fallbackFor(action: SupabaseAuthAction): string {
  if (action === "login") return LOGIN_FALLBACK;
  if (action === "register") return REGISTER_FALLBACK;
  return RESET_FALLBACK;
}

/**
 * Turn Supabase Auth errors into messages that are useful in the UI without
 * leaking provider internals. Unknown errors fall back to a safe message.
 */
export function supabaseAuthErrorMessage(
  error: SupabaseAuthErrorLike | null | undefined,
  action: SupabaseAuthAction,
): string {
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").trim();

  switch (code) {
    case "email_not_confirmed":
      return "Confirm your email before signing in. Check your inbox for the verification link.";
    case "invalid_credentials":
      return LOGIN_FALLBACK;
    case "user_already_exists":
    case "email_exists":
      return "An account already exists for this email. Sign in instead.";
    case "weak_password":
      return (
        message ||
        "Choose a stronger password with at least 8 characters, a letter and a number."
      );
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
    case "rate_limit_exceeded":
      return "Too many attempts. Wait a minute and try again.";
    case "signup_disabled":
      return "New sign-ups are disabled for this Supabase project.";
    case "email_provider_disabled":
      return "Email sign-in is disabled for this Supabase project.";
    case "user_banned":
      return "This account is unavailable. Contact the studio owner.";
    case "same_password":
      return "Choose a password you have not used before.";
    case "session_not_found":
    case "refresh_token_not_found":
      return "Your recovery session has expired. Request a new reset link.";
    case "captcha_failed":
      return "The security check failed. Refresh the page and try again.";
    default:
      break;
  }

  // Older Supabase versions sometimes return only a message.
  if (/email not confirmed/i.test(message)) {
    return "Confirm your email before signing in. Check your inbox for the verification link.";
  }
  if (/invalid login credentials/i.test(message)) return LOGIN_FALLBACK;
  if (/user already registered|already been registered/i.test(message)) {
    return "An account already exists for this email. Sign in instead.";
  }
  if (/password should be at least|weak password/i.test(message)) return message;
  if (/rate limit|too many requests/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }

  return fallbackFor(action);
}
