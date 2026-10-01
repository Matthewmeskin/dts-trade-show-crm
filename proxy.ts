import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hubSignInUrl, localPath } from "@/lib/dts-login";

/**
 * Paths an unauthenticated visitor may reach. API routes are public to the
 * proxy because they authenticate themselves (a user session for app APIs, a
 * bearer secret for the TMS ingest) and must return JSON — never a redirect
 * to the login page.
 */
const PUBLIC_PREFIXES = ["/login", "/auth", "/api", "/reset-password"];

// Next.js 16 "proxy" convention: a NAMED `proxy` export (not a default export).
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Build a redirect that preserves any auth cookies Supabase set/cleared
  // during getUser() above. Returning a bare NextResponse.redirect would drop
  // those Set-Cookie headers, so an expired/invalid session never clears and
  // the browser loops ("page isn't redirecting properly").
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const res = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  // One DTS sign-in (lib/dts-login.ts): a signed-out visitor goes to the
  // hub's shared login page and comes back signed in, to the page they asked
  // for. Someone already signed in at the hub never sees a login at all.
  const toHub = (next: string) => {
    const res = NextResponse.redirect(hubSignInUrl(next));
    for (const cookie of supabaseResponse.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };
  if (!user && !isPublic) return toHub(pathname + request.nextUrl.search);

  // /login itself goes to the shared login too. ?local=1 keeps the CRM's own
  // form, for a failed hand-off or a hub outage.
  if (!user && pathname === "/login" && !request.nextUrl.searchParams.has("local")) {
    return toHub(localPath(request.nextUrl.searchParams.get("redirect")));
  }

  // Signed-in users hitting /login are sent to the dashboard.
  if (user && pathname === "/login") return redirectTo("/");

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
