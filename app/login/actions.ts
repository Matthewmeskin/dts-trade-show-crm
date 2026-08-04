"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  LAST_ACTIVITY_COOKIE,
  SESSION_START_COOKIE,
  SESSION_EXP_COOKIE,
} from "@/lib/auth/session-timeout";

export type LoginState = { error: string | null };

/**
 * Clear our session-timeout cookies so a new session starts with a fresh
 * absolute-lifetime baseline. Without this, a stale `dts-session-start` from a
 * previous session would carry over and could instantly expire a fresh login.
 */
async function clearSessionTimeoutCookies() {
  const store = await cookies();
  for (const name of [
    LAST_ACTIVITY_COOKIE,
    SESSION_START_COOKIE,
    SESSION_EXP_COOKIE,
  ]) {
    store.delete(name);
  }
}

/** Email + password sign-in. Internal users only (no public sign-up). */
export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/") || "/";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Fresh session — reset the timeout baseline (the proxy re-establishes it on
  // the next request).
  await clearSessionTimeoutCookies();
  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSessionTimeoutCookies();
  revalidatePath("/", "layout");
  redirect("/login");
}
