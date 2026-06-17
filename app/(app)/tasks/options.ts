import { createClient } from "@/lib/supabase/server";
import type { RelatedOptions } from "./task-form";

/** Load the dropdown options for the task form (assignees + related records). */
export async function loadTaskOptions(): Promise<{
  profiles: { id: string; label: string }[];
  related: RelatedOptions;
}> {
  const supabase = await createClient();
  const [profilesRes, showsRes, exhibitorsRes, shipmentsRes, carriersRes, venuesRes] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
      supabase.from("exhibitors").select("id, company_name").order("company_name"),
      supabase
        .from("shipments")
        .select("id, pro_number, exhibitor:exhibitors(company_name), show:shows(show_name)")
        .order("created_at", { ascending: false }),
      supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
      supabase.from("venues").select("id, venue_name").order("venue_name"),
    ]);

  return {
    profiles: (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      label: p.full_name?.trim() || p.email || "Unnamed user",
    })),
    related: {
      shows: (showsRes.data ?? []).map((s) => ({
        id: s.id,
        label: `${s.show_name}${s.edition_year ? ` ${s.edition_year}` : ""}`,
      })),
      exhibitors: (exhibitorsRes.data ?? []).map((e) => ({ id: e.id, label: e.company_name })),
      shipments: (shipmentsRes.data ?? []).map((s) => ({
        id: s.id,
        label:
          (s.exhibitor?.company_name ?? "Shipment") +
          (s.show?.show_name ? ` · ${s.show.show_name}` : "") +
          (s.pro_number ? ` · PRO ${s.pro_number}` : ""),
      })),
      carriers: (carriersRes.data ?? []).map((c) => ({ id: c.id, label: c.carrier_name })),
      venues: (venuesRes.data ?? []).map((v) => ({ id: v.id, label: v.venue_name })),
    },
  };
}
