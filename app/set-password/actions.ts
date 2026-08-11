"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error: string | null };

/**
 * Let a signed-in user (arriving from an invite / reset link, already verified
 * by /auth/confirm) choose their own password. Guards on an active session so a
 * stale link can't set a password for nobody.
 */
export async function setOwnPassword(
  _prev: SetPasswordState,
  fd: FormData,
): Promise<SetPasswordState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "Your setup link is invalid or has expired. Ask an admin to resend the invite.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/?flash=welcome");
}
