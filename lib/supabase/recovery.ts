"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * A throwaway auth client for the password-reset flow only. It uses the
 * implicit grant (tokens arrive in the URL fragment) rather than PKCE, so a
 * reset link works when it is opened on a different device or browser from
 * the one that asked for it. It never touches the app's cookie session: the
 * reset page updates the password and sends the person back to /login.
 */
export function createRecoveryClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: false,
        storageKey: "dts-recovery",
      },
    },
  );
}
