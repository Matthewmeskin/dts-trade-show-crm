import type { createClient } from "@/lib/supabase/server";
import { todayYMD } from "@/lib/format";
import { buildPartnerReport, type PartnerReport } from "@/lib/partner-report";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Everything the weekly report needs for one partner, read under the user's session. */
export async function loadPartnerReport(
  supabase: Supabase,
  partnerId: string,
): Promise<{ report: PartnerReport; clientCount: number; pilotCount: number } | null> {
  const { data: partner } = await supabase
    .from("partners")
    .select("name, rep_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return null;

  const [{ data: clientRows }, { data: links }, { data: rep }] = await Promise.all([
    supabase.from("partner_clients").select("exhibitor_id, in_pilot, exhibitors(company_name)").eq("partner_id", partnerId),
    supabase.from("partner_shows").select("show_id, shows(id, show_name, show_start_date, show_end_date)").eq("partner_id", partnerId),
    partner.rep_id
      ? supabase.from("profiles").select("full_name, email, phone").eq("id", partner.rep_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const clients = (clientRows ?? []).map((c) => ({
    exhibitor_id: c.exhibitor_id,
    company_name: c.exhibitors?.company_name ?? "—",
    in_pilot: c.in_pilot,
  }));
  const ids = clients.map((c) => c.exhibitor_id);

  const [{ data: shipments }, { data: rosters }] = ids.length
    ? await Promise.all([
        supabase
          .from("shipments")
          .select(
            "id, exhibitor_id, show_id, direction, status, destination_type, pickup_date, estimated_delivery_date, actual_delivery_date, show_date, created_at, pro_number, tracking_url, booth_number, pieces, origin_city, origin_state, consignee_city, consignee_state",
          )
          .in("exhibitor_id", ids)
          .limit(5000),
        supabase.from("show_exhibitors").select("show_id, exhibitor_id").in("exhibitor_id", ids).limit(5000),
      ])
    : [{ data: [] }, { data: [] }];

  // The partner's own shows, plus any show their clients' freight is headed to.
  const showBy = new Map<string, { id: string; show_name: string; start: string | null; end: string | null }>();
  for (const l of links ?? []) {
    if (l.shows) showBy.set(l.shows.id, { id: l.shows.id, show_name: l.shows.show_name, start: l.shows.show_start_date, end: l.shows.show_end_date });
  }
  const missing = [
    ...new Set([...(shipments ?? []).map((s) => s.show_id), ...(rosters ?? []).map((r) => r.show_id)].filter((x): x is string => !!x && !showBy.has(x))),
  ];
  if (missing.length) {
    const { data: more } = await supabase
      .from("shows")
      .select("id, show_name, show_start_date, show_end_date")
      .in("id", missing.slice(0, 500));
    for (const s of more ?? []) showBy.set(s.id, { id: s.id, show_name: s.show_name, start: s.show_start_date, end: s.show_end_date });
  }

  const report = buildPartnerReport({
    partnerName: partner.name,
    clients,
    shows: [...showBy.values()],
    rosters: rosters ?? [],
    shipments: shipments ?? [],
    today: todayYMD(),
    rep: rep ? { name: rep.full_name || rep.email || "Your DTS contact", phone: rep.phone, email: rep.email } : null,
  });
  return { report, clientCount: clients.length, pilotCount: clients.filter((c) => c.in_pilot).length };
}
