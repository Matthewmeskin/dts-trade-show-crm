import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The partner growth tooling (worklist, booked calls, weekly client report,
 * rebate statements, cobranded show page controls) that the GSC Shipping
 * Center replaced. Hidden unless an admin turns it on (migration 0048). Any
 * failure to read the switch, including the table not existing yet, reads as
 * off: hidden is the safe side.
 */
export async function partnerToolsOn(supabase: Supabase): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("app_settings").select("enabled").eq("key", "partner_tools").maybeSingle();
    return !error && data?.enabled === true;
  } catch {
    return false;
  }
}
