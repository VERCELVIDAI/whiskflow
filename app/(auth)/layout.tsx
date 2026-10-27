export const dynamic = "force-dynamic";

/**
 * Auth pages intentionally do not redirect signed-in visitors here.
 *
 * The proxy handles the safe Supabase case. A local session cookie can be
 * stale or invalid, and redirecting based on its presence would trap the user
 * in a /login -> / -> /login loop. The auth API validates credentials again.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
