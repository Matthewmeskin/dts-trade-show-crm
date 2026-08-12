"use server";

import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Verify an invite / password-reset token — only ever from the POST triggered
 * by the user clicking "Activate account". Keeping the one-time verifyOtp off
 * the GET means an email scanner pre-fetching the link (e.g. Outlook Safe
 * Links) can't consume the single-use token before the real click.
 */
export async function confirmSetup(fd: FormData) {
  const token_hash = String(fd.get("token_hash") ?? "");
  const type = String(fd.get("type") ?? "") as EmailOtpType;
  const nextRaw = String(fd.get("next") ?? "/set-password");
  const next = nextRaw.startsWith("/") ? nextRaw : "/set-password";

  if (!token_hash || !type) {
    redirect("/login?reason=link_invalid&detail=missing_token");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    redirect(`/login?reason=link_invalid&detail=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}
