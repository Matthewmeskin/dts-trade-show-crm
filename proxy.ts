import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LAST_ACTIVITY_COOKIE, isIdleExpired } from "@/lib/auth/session-timeout";

/**
 * Paths an unauthenticated visitor may reach. API routes are public to the
 * proxy because they authenticate themselves (a user session for app APIs, a
 * bearer secret for the TMS ingest) and must return JSON — never a redirect
 * to the login page.
 */
const PUBLIC_PREFIXES = ["/login", "/auth", "/api"];

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
  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const res = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  // Refresh the server-authoritative idle timer on `response`, stamping now.
  const stampActivity = (response: NextResponse, now: number) => {
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  };

  // Unauthenticated visitors are sent to /login (except on public routes).
  if (!user && !isPublic) return redirectTo("/login");

  // Idle-session enforcement. Supabase refresh tokens renew forever, so a stale
  // `dts-last-activity` cookie is our only signal that a signed-in session has
  // gone idle. Runs before every other authenticated branch so an expired
  // session can never slip through to an app page.
  if (user) {
    const now = Date.now();
    const raw = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const last = raw ? Number(raw) : NaN;

    if (Number.isFinite(last) && isIdleExpired(last, now)) {
      // Idle past the window: revoke the session and bounce to login. signOut()
      // clears the sb-* auth cookies via setAll into supabaseResponse, which
      // redirectTo copies onto the redirect. Guard the network revoke so a
      // transient failure can't leave the session alive.
      try {
        await supabase.auth.signOut();
      } catch {
        // Fall through — we still expire the cookies below.
      }
      const res = redirectTo("/login", "reason=timeout");
      // Belt-and-suspenders: expire the activity cookie and every sb-* auth
      // cookie directly, in case signOut() didn't reach the auth server.
      res.cookies.set(LAST_ACTIVITY_COOKIE, "", { path: "/", maxAge: 0 });
      for (const { name } of request.cookies.getAll()) {
        if (name.startsWith("sb-")) res.cookies.set(name, "", { path: "/", maxAge: 0 });
      }
      return res;
    }

    // Signed-in users hitting /login are sent to the dashboard.
    if (pathname === "/login") {
      const res = redirectTo("/");
      stampActivity(res, now);
      return res;
    }

    // Live request — reset the idle timer.
    stampActivity(supabaseResponse, now);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
