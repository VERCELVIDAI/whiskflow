import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSignedInRedirectPath } from "@/lib/auth/redirect";

const PROTECTED_PREFIXES = [
  "/",
  "/create",
  "/projects",
  "/media",
  "/templates",
  "/favorites",
  "/trash",
  "/pricing",
  "/usage",
  "/settings",
  "/help",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`)),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const usesSupabase = Boolean(supabaseUrl && supabaseKey);

  let response = NextResponse.next({ request });
  let hasUser = false;

  if (usesSupabase) {
    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasUser = Boolean(user);
  } else {
    hasUser = Boolean(request.cookies.get("wf_session")?.value);
  }

  if (isProtected(pathname) && !hasUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Only Supabase sessions are validated here. A local cookie is merely
  // present until the studio layout verifies it, so redirecting local users
  // away from /login could loop when that cookie is stale.
  if (usesSupabase && hasUser && isSignedInRedirectPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next/static|_next/image|samples|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|mp4|webm|ico)$).*)",
  ],
};
