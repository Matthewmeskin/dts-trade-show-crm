import type { createClient } from "@/lib/supabase/server";
import { dayOf, todayYMD } from "@/lib/format";
import { shiftDays } from "@/lib/sales";
import {
  buildManifest,
  candidateReason,
  manifestCadence,
  manifestDue,
  type Cadence,
  type CandidateShow,
  type Manifest,
} from "@/lib/gsc-manifest";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SHOW_FIELDS =
  "id, show_name, show_start_date, show_end_date, move_in_start, move_in_end, move_out_start, move_out_end, advance_warehouse_open, advance_warehouse_cutoff, advance_warehouse_name, venue_id, advance_warehouse_zip, direct_to_show_zip";

export type ManifestOption = {
  partnerShowId: string;
  show: CandidateShow;
  cadence: Cadence;
  due: boolean;
  sentAt: string | null;
};

export type Candidate = {
  id: string;
  exhibitor: string;
  status: string;
  direction: string | null;
  pickup: string | null;
  to: string | null;
  reason: string;
};

/** The shows a GSC services, with what each one's manifest wants today. */
export async function loadManifestOptions(supabase: Supabase, partnerId: string): Promise<ManifestOption[]> {
  const today = todayYMD();
  const { data } = await supabase
    .from("partner_shows")
    .select(`id, manifest_sent_at, shows(${SHOW_FIELDS})`)
    .eq("partner_id", partnerId);
  return (data ?? [])
    .filter((r) => r.shows)
    .map((r) => {
      const show = r.shows as unknown as CandidateShow;
      const cadence = manifestCadence(show, today);
      return {
        partnerShowId: r.id,
        show,
        cadence,
        due: manifestDue(cadence, r.manifest_sent_at ? dayOf(r.manifest_sent_at) : null, today),
        sentAt: r.manifest_sent_at,
      };
    })
    .sort((a, b) => (a.show.move_in_start ?? a.show.show_start_date ?? "9999").localeCompare(b.show.move_in_start ?? b.show.show_start_date ?? "9999"));
}

/** One show's manifest, plus the unlinked loads that probably belong on it. */
export async function loadManifest(
  supabase: Supabase,
  partner: { name: string; public_name: string | null; rep_id: string | null },
  option: ManifestOption,
): Promise<{ manifest: Manifest; candidates: Candidate[] }> {
  const today = todayYMD();
  const show = option.show;
  const [{ data: rows }, { data: rep }] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, direction, status, destination_type, booth_number, pieces, weight, pro_number, pickup_date, estimated_delivery_date, actual_delivery_date, origin_city, origin_state, exhibitor:exhibitors(company_name), carrier:carriers(carrier_name)",
      )
      .eq("show_id", show.id)
      .limit(2000),
    partner.rep_id
      ? supabase.from("profiles").select("full_name, email, phone").eq("id", partner.rep_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const manifest = buildManifest({
    gscName: partner.public_name ?? partner.name,
    show,
    shipments: (rows ?? []).map((s) => ({
      id: s.id,
      exhibitor: s.exhibitor?.company_name ?? "Exhibitor",
      direction: s.direction,
      status: s.status,
      destination_type: s.destination_type,
      booth_number: s.booth_number,
      pieces: s.pieces,
      weight: s.weight,
      carrier: s.carrier?.carrier_name ?? null,
      pro_number: s.pro_number,
      pickup_date: s.pickup_date,
      estimated_delivery_date: s.estimated_delivery_date,
      actual_delivery_date: s.actual_delivery_date,
      origin_city: s.origin_city,
      origin_state: s.origin_state,
    })),
    today,
    rep: rep ? { name: rep.full_name || rep.email || "Your DTS contact", phone: rep.phone, email: rep.email } : null,
  });

  // Unlinked loads in the show's freight window, narrowed in code to the ones
  // pointed at this show's venue, warehouse or site.
  const open = [show.advance_warehouse_open, show.move_in_start, show.show_start_date].filter((d): d is string => !!d).sort()[0];
  const close = show.move_out_end ?? show.show_end_date ?? show.show_start_date;
  let candidates: Candidate[] = [];
  if (open && close) {
    const { data: loose } = await supabase
      .from("shipments")
      .select(
        "id, venue_id, direction, status, pickup_date, show_date, created_at, consignee_zip, origin_zip, consignee_city, consignee_state, exhibitor:exhibitors(company_name)",
      )
      .is("show_id", null)
      .gte("pickup_date", shiftDays(open, -30)!)
      .lte("pickup_date", shiftDays(close, 10)!)
      .limit(2000);
    candidates = (loose ?? [])
      .map((s) => ({ s, reason: candidateReason(show, s) }))
      .filter((x): x is { s: NonNullable<typeof loose>[number]; reason: string } => !!x.reason)
      .map(({ s, reason }) => ({
        id: s.id,
        exhibitor: s.exhibitor?.company_name ?? "Exhibitor",
        status: s.status,
        direction: s.direction,
        pickup: s.pickup_date,
        to: [s.consignee_city, s.consignee_state].filter(Boolean).join(", ") || null,
        reason,
      }))
      .sort((a, b) => (a.pickup ?? "").localeCompare(b.pickup ?? ""));
  }
  return { manifest, candidates };
}
