import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ABSOLUTE_SESSION_MS,
  LAST_ACTIVITY_COOKIE,
  SESSION_START_COOKIE,
  SESSION_EXP_COOKIE,
  isIdleExpired,
  isSessionExpired,
} from "@/lib/auth/session-timeout";

/**
 * Paths an unauthenticated visitor may reach. API routes are public to the
 * proxy because they authenticate themselves (a user session for app APIs, a
 * bearer secret for the TMS ingest) and must return JSON — never a redirect
 * to the login page.
 */
const PUBLIC_PREFIXES = ["/login", "/auth", "/api"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Is this a path an unauthenticated visitor may reach? */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Next.js 16 "proxy" convention: a NAMED `proxy` export (not a default export).
export async function proxy(request: NextRequest) {
  // Without Supabase credentials we can't evaluate a session. Fail open to the
  // login page (which explains the misconfiguration) instead of constructing a
  // client with undefined values — that throws, and because this proxy matches
  // every route it would turn one missing env var into an opaque 500 sitewide.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "reason=misconfigured";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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
  const isPublic = isPublicPath(pathname);

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

  const secure = process.env.NODE_ENV === "production";

  // Refresh the server-authoritative idle timer on `response`, stamping now.
  const stampActivity = (response: NextResponse, now: number) => {
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
    });
  };

  // Revoke the session and bounce to /login with a reason. Fail-closed: even if
  // the network revoke throws, we expire every auth cookie directly so a
  // transient failure can't leave the session alive. signOut() also clears the
  // sb-* cookies via setAll into supabaseResponse, which redirectTo copies over.
  const expireSession = async (reason: string) => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Fall through — the explicit cookie clears below still end the session.
    }
    const res = redirectTo("/login", `reason=${reason}`);
    for (const name of [
      LAST_ACTIVITY_COOKIE,
      SESSION_START_COOKIE,
      SESSION_EXP_COOKIE,
    ]) {
      res.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    for (const { name } of request.cookies.getAll()) {
      if (name.startsWith("sb-")) res.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    return res;
  };

  // Unauthenticated visitors are sent to /login (except on public routes).
  if (!user && !isPublic) return redirectTo("/login");

  // Session enforcement. Supabase refresh tokens renew forever, so our cookies
  // are the only signal that a signed-in session should end. Runs before every
  // other authenticated branch so an expired session can never reach an app
  // page.
  if (user) {
    const now = Date.now();

    // Absolute lifetime — a hard ceiling regardless of activity.
    const startRaw = request.cookies.get(SESSION_START_COOKIE)?.value;
    const start = startRaw ? Number(startRaw) : NaN;
    if (Number.isFinite(start) && isSessionExpired(start, now)) {
      return await expireSession("expired");
    }

    // Idle timeout — stale since the last seen activity.
    const lastRaw = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const last = lastRaw ? Number(lastRaw) : NaN;
    if (Number.isFinite(last) && isIdleExpired(last, now)) {
      return await expireSession("timeout");
    }

    // Signed-in users hitting /login are sent to the dashboard; otherwise the
    // request passes through. Either way we stamp the timers onto that response.
    const res = pathname === "/login" ? redirectTo("/") : supabaseResponse;

    // Reset the idle timer on every live request.
    stampActivity(res, now);

    // Establish the session-start / expiry stamps once, on the first
    // authenticated request after login; never refreshed afterwards so the
    // ceiling is fixed to when the session actually began.
    if (!Number.isFinite(start)) {
      res.cookies.set(SESSION_START_COOKIE, String(now), {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
      });
      // Readable by the client so it can sign an active user out at the cap.
      res.cookies.set(SESSION_EXP_COOKIE, String(now + ABSOLUTE_SESSION_MS), {
        httpOnly: false,
        sameSite: "lax",
        secure,
        path: "/",
      });
    }

    if (pathname === "/login") return res;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
