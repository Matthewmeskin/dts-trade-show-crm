import type { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { todayYMD } from "@/lib/format";
import {
  buildRebateDraft,
  creditSuggestions,
  type ArRow,
  type CreditSuggestion,
  type CreditedShipment,
  type Quarter,
  type RebateDraft,
} from "@/lib/rebates";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The AR ledger lookup, in chunks (a long id list doesn't fit in one call). */
export async function loadArStatus(supabase: Supabase, ids: string[]): Promise<ArRow[]> {
  const out: ArRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc("shipment_ar_status", { p_shipment_ids: ids.slice(i, i + 200) });
    if (error) throw new Error(`AR status: ${error.message}`);
    out.push(...((data ?? []) as ArRow[]));
  }
  return out;
}

async function creditedShipments(supabase: Supabase, partnerId: string): Promise<CreditedShipment[]> {
  const rows = await fetchAll(() =>
    supabase
      .from("shipments")
      .select(
        "id, tms_reference_id, status, billed_amount, cost_amount, pickup_date, partner_credit_source, exhibitor:exhibitors(company_name), show:shows(show_name)",
      )
      .eq("partner_id", partnerId)
      // The database refuses credit on a Shipping Center load; this says so here too.
      .eq("source", "tms")
      .order("id"),
  );
  return rows.map((r) => ({
    id: r.id,
    tms_reference_id: r.tms_reference_id,
    status: r.status,
    billed_amount: r.billed_amount,
    cost_amount: r.cost_amount,
    cancelled_at: null,
    pickup_date: r.pickup_date,
    partner_credit_source: r.partner_credit_source,
    exhibitor_name: r.exhibitor?.company_name ?? null,
    show_name: r.show?.show_name ?? null,
  }));
}

/** Every credited load for the partner, where each stands, and the quarter's statement as it would be issued now. */
export async function loadRebateDraft(
  supabase: Supabase,
  partnerId: string,
  quarter: Quarter,
): Promise<{
  partner: { name: string; incentive_model: string | null; rebate_pct: number | null; commission_basis: string | null };
  draft: RebateDraft;
  credited: CreditedShipment[];
  ar: ArRow[];
} | null> {
  const { data: partner } = await supabase
    .from("partners")
    .select("name, incentive_model, rebate_pct, commission_basis")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return null;
  const credited = await creditedShipments(supabase, partnerId);
  const ids = credited.map((c) => c.id);
  // A credited load can't change partner once it's on a statement (a trigger
  // guards it), so this partner's statements hold every line that matters.
  const [ar, { data: statements }] = await Promise.all([
    loadArStatus(supabase, ids),
    supabase.from("partner_rebate_statements").select("id, quarter").eq("partner_id", partnerId),
  ]);
  const statementIds = (statements ?? []).map((s) => s.id);
  const stated = statementIds.length
    ? await fetchAll(() => supabase.from("partner_rebate_lines").select("shipment_id").in("statement_id", statementIds).order("id"))
    : [];
  const issued = (statements ?? []).some((s) => s.quarter === quarter.label);
  const draft = buildRebateDraft({
    quarter,
    incentiveModel: partner.incentive_model,
    rebatePct: partner.rebate_pct,
    shipments: credited,
    ar,
    alreadyStated: new Set(stated.map((s) => s.shipment_id).filter((x): x is string => !!x)),
    quarterIssued: issued,
    today: todayYMD(),
  });
  return { partner, draft, credited, ar };
}

/** For the partner page: what's credited, and what probably should be. */
export async function loadCreditSummary(
  supabase: Supabase,
  partnerId: string,
): Promise<{ creditedCount: number; suggestions: CreditSuggestion[] }> {
  const [{ count }, { data: clients }] = await Promise.all([
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    supabase.from("partner_clients").select("exhibitor_id, created_at, exhibitors(company_name)").eq("partner_id", partnerId),
  ]);
  const clientList = (clients ?? []).map((c) => ({
    exhibitor_id: c.exhibitor_id,
    company_name: c.exhibitors?.company_name ?? "—",
    linked_on: c.created_at.slice(0, 10),
  }));
  if (!clientList.length) return { creditedCount: count ?? 0, suggestions: [] };
  const { data: ships } = await supabase
    .from("shipments")
    .select("id, exhibitor_id, partner_id, status, tms_reference_id, tms_created_at, created_at, billed_amount, show:shows(show_name)")
    .in("exhibitor_id", clientList.map((c) => c.exhibitor_id))
    .is("partner_id", null)
    .eq("source", "tms")
    .neq("status", "quoted")
    .limit(2000);
  const suggestions = creditSuggestions(
    clientList,
    (ships ?? []).map((s) => ({
      id: s.id,
      exhibitor_id: s.exhibitor_id,
      partner_id: s.partner_id,
      status: s.status,
      cancelled_at: null,
      tms_reference_id: s.tms_reference_id,
      booked_on: (s.tms_created_at ?? s.created_at).slice(0, 10),
      show_name: s.show?.show_name ?? null,
      billed_amount: s.billed_amount,
    })),
  );
  return { creditedCount: count ?? 0, suggestions };
}
