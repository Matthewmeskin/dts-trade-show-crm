import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { dbSchema } from "@/lib/supabase/schema";

/**
 * Supabase client for use in Client Components (runs in the browser).
 * Uses the public anon key; all access is gated by RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: dbSchema() } },
  );
}
