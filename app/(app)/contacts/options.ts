import { createClient } from "@/lib/supabase/server";
import type { ContactOptions } from "./contact-form";

/** Load the attachment dropdown options for the contact form. */
export async function loadContactOptions(): Promise<ContactOptions> {
  const supabase = await createClient();
  const [showsRes, exhibitorsRes, venuesRes, carriersRes] = await Promise.all([
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
    supabase.from("exhibitors").select("id, company_name").order("company_name"),
    supabase.from("venues").select("id, venue_name").order("venue_name"),
    supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
  ]);

  return {
    shows: (showsRes.data ?? []).map((s) => ({
      id: s.id,
      label: `${s.show_name}${s.edition_year ? ` ${s.edition_year}` : ""}`,
    })),
    exhibitors: (exhibitorsRes.data ?? []).map((e) => ({ id: e.id, label: e.company_name })),
    venues: (venuesRes.data ?? []).map((v) => ({ id: v.id, label: v.venue_name })),
    carriers: (carriersRes.data ?? []).map((c) => ({ id: c.id, label: c.carrier_name })),
  };
}
