import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client. SERVER-ONLY — bypasses RLS, never expose to the
 * browser. Used by trusted server-to-server integrations (the TMS ingest
 * endpoint). Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
