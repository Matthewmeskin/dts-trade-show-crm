import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Single sign-on from the DTS operations hub (see lib/dts-login.ts). The hub
 * and this app share one Supabase project, so a user signed in there is
 * already a user here; only the cookies differ by domain. The hub hands over
 * its access token (in a URL fragment, so it never appears in a server log);
 * this checks it against the shared auth server, then mints a fresh session
 * of this app's own through a server-side magic-link exchange. A new session,
 * not the hub's refresh token: refresh tokens rotate on use, and two apps
 * sharing one would end up signing each other out. Same as the vetting
 * portal's /api/auth/sso.
 */
export async function POST(request: Request) {
  let accessToken = "";
  try {
    const body = await request.json();
    accessToken = String(body?.access_token ?? "");
  } catch {
    /* falls through to the guard below */
  }
  if (!accessToken) {
    return NextResponse.json({ error: "missing access_token" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Whose token is this? getUser validates it with the auth server, so an
  // expired or forged token stops here.
  const { data: who, error: whoErr } = await admin.auth.getUser(accessToken);
  const email = who?.user?.email;
  if (whoErr || !email) {
    return NextResponse.json({ error: "invalid session token" }, { status: 401 });
  }

  // A one-time magic-link token for that user, consumed right here:
  // generateLink sends no email, and verifyOtp sets this app's session cookies.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    return NextResponse.json({ error: "could not create session" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (otpErr) {
    return NextResponse.json({ error: otpErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
