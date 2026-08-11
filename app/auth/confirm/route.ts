import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for the links in Supabase's invite / password-reset emails.
 * The email template points here with a one-time `token_hash` + `type`; we
 * verify it (which sets the session cookie — no PKCE code_verifier needed, so
 * it works for admin-initiated invites) then send the user on to `next`
 * (the set-password page by default). Public: `/auth/*` is allowed by the proxy.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/set-password";
  const next = nextParam.startsWith("/") ? nextParam : "/set-password";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?reason=link_invalid`);
}
