const FALLBACK_PATH = "/";

/**
 * Only allow same-origin, absolute paths as post-auth destinations.
 * Protocol-relative URLs (`//evil.example`) and backslash tricks are rejected.
 */
export function safeNextPath(value: string | null | undefined, fallback = FALLBACK_PATH): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

/**
 * Auth pages that a signed-in Supabase user should skip.
 *
 * Password recovery is deliberately excluded: Supabase creates a temporary
 * session before redirecting to /reset-password, and that page must stay
 * reachable while the session exists.
 */
export const SIGNED_IN_REDIRECT_PATHS = ["/login", "/register", "/forgot-password"] as const;

export function isSignedInRedirectPath(pathname: string): boolean {
  return (SIGNED_IN_REDIRECT_PATHS as readonly string[]).includes(pathname);
}
