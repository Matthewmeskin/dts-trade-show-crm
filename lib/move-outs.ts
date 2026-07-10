import { createClient } from "@/lib/supabase/server";
import { MOVE_OUT_COUNTER_EPOCH } from "@/lib/forced";
import { fetchAll } from "@/lib/supabase/fetch-all";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MoveOutRow = {
  id: string;
  exhibitor: string | null;
  show: string | null;
  carrier: string | null;
  /** The date we credit the successful move-out to. */
  deliveredOn: string | null;
  pickupDate: string | null;
};

export type SuccessfulMoveOuts = {
  rows: MoveOutRow[];
  /** The date counting resumes from: the last forced event, or the epoch. */
  resetDate: string;
  lastForcedAt: string | null;
};

/**
 * The most recent forced move-out resets the streak. Counting resumes from that
 * day, or from the feature-launch epoch if nothing has been forced since.
 */
export async function resolveMoveOutReset(
  supabase: Supabase,
): Promise<{ resetDate: string; lastForcedAt: string | null }> {
  const { data: lastForcedRow } = await supabase
    .from("shipments")
    .select("forced_at")
    .eq("forced", true)
    .not("forced_at", "is", null)
    .order("forced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastForcedAt = lastForcedRow?.forced_at ?? null;
  const resetDate =
    lastForcedAt && lastForcedAt.slice(0, 10) > MOVE_OUT_COUNTER_EPOCH
      ? lastForcedAt.slice(0, 10)
      : MOVE_OUT_COUNTER_EPOCH;
  return { resetDate, lastForcedAt };
}

/**
 * Delivered, non-forced move-outs credited on or after the reset date — the
 * loads behind the dashboard's "successful move-outs" counter, newest first.
 */
export async function loadSuccessfulMoveOuts(
  supabase?: Supabase,
): Promise<SuccessfulMoveOuts> {
  const sb = supabase ?? (await createClient());
  const { resetDate, lastForcedAt } = await resolveMoveOutReset(sb);

  const raw = await fetchAll<{
    id: string;
    actual_delivery_date: string | null;
    target_delivery_date: string | null;
    show_date: string | null;
    created_at: string | null;
    pickup_date: string | null;
    exhibitor: { company_name: string } | null;
    show: { show_name: string } | null;
    carrier: { carrier_name: string } | null;
  }>(() =>
    sb
      .from("shipments")
      .select(
        "id, actual_delivery_date, target_delivery_date, show_date, created_at, pickup_date, exhibitor:exhibitors(company_name), show:shows(show_name), carrier:carriers(carrier_name)",
      )
      .eq("direction", "move_out")
      .eq("forced", false)
      .eq("status", "delivered"),
  );

  const rows: MoveOutRow[] = raw
    .map((r) => ({
      id: r.id,
      exhibitor: r.exhibitor?.company_name ?? null,
      show: r.show?.show_name ?? null,
      carrier: r.carrier?.carrier_name ?? null,
      // Same fallback chain the counter uses to date the delivery.
      deliveredOn:
        r.actual_delivery_date ??
        r.target_delivery_date ??
        r.show_date ??
        (r.created_at ? r.created_at.slice(0, 10) : null),
      pickupDate: r.pickup_date,
    }))
    .filter((r) => r.deliveredOn != null && r.deliveredOn >= resetDate)
    .sort((a, b) => (b.deliveredOn ?? "").localeCompare(a.deliveredOn ?? ""));

  return { rows, resetDate, lastForcedAt };
}
