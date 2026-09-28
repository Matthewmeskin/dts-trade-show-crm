import { createAdminClient } from "@/lib/supabase/admin";
import { publicRpc } from "@/lib/public-sync";
import { changed, statusRow, type StatusRow } from "@/lib/ship-status";

/**
 * Send each Shipping Center leg's status, carrier, PRO and dates to the
 * exhibitor's status page (apply_request_status_signed; never a price).
 *
 * Runs after the pull in the 15 minute sync, and right after a coordinator
 * quotes, books or closes, so the exhibitor's page keeps up. Only what changed
 * since the public project last accepted it is sent, and only what it says
 * it applied is recorded, so a row it skipped (the exhibitor had moved on
 * since the last pull) goes again once the CRM has caught up.
 *
 * Env: TRADE_SHOW_STATUS_SECRET (this feed's own secret; the public project
 * stores its SHA-256 as purpose 'crm_status'), plus the sync's URL and key.
 */

export type PushResult = { ok: boolean; skipped?: boolean; sent: number; applied: number; closed: number; error?: string };

export function pushConfigured(): boolean {
  return Boolean(
    process.env.TRADE_SHOW_SUPABASE_URL &&
      process.env.TRADE_SHOW_SUPABASE_PUBLISHABLE_KEY &&
      process.env.TRADE_SHOW_STATUS_SECRET &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Requests older than this are left alone: their shows are long over. */
const WINDOW_DAYS = 200;

export async function pushShipStatus(): Promise<PushResult> {
  if (!pushConfigured()) return { ok: true, skipped: true, sent: 0, applied: 0, closed: 0 };
  const sb = createAdminClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
  try {
    const { data: reqs, error } = await sb
      .from("ship_request_inbox")
      .select("id, public_request_id, exhibitor_version, closed, pushed_closed, ship_request_legs(id, public_leg_id, stage, pushed)")
      .gte("received_at", since)
      .limit(2000);
    if (error) throw new Error(error.message);

    const legIds = (reqs ?? []).flatMap((r) => (r.ship_request_legs ?? []).map((l) => l.id));
    const loads = new Map<string, { status: string | null; pro_number: string | null; pickup_date: string | null; estimated_delivery_date: string | null; actual_delivery_date: string | null; carrier_name: string | null }>();
    for (let i = 0; i < legIds.length; i += 300) {
      const { data, error: e } = await sb
        .from("shipments")
        .select("ship_leg_id, status, pro_number, pickup_date, estimated_delivery_date, actual_delivery_date, carriers(carrier_name)")
        .in("ship_leg_id", legIds.slice(i, i + 300));
      if (e) throw new Error(e.message);
      for (const s of data ?? []) {
        if (s.ship_leg_id) loads.set(s.ship_leg_id, { ...s, carrier_name: s.carriers?.carrier_name ?? null });
      }
    }

    const rows: { crmLegId: string; row: StatusRow }[] = [];
    const closes: { id: string; public_request_id: string }[] = [];
    for (const r of reqs ?? []) {
      if (r.closed && !r.pushed_closed) closes.push({ id: r.id, public_request_id: r.public_request_id });
      for (const l of r.ship_request_legs ?? []) {
        const row = statusRow(l, r.exhibitor_version, loads.get(l.id) ?? null);
        if (changed(row, l.pushed)) rows.push({ crmLegId: l.id, row });
      }
    }

    let applied = 0;
    const byPublic = new Map(rows.map((x) => [x.row.leg_id, x]));
    for (let i = 0; i < rows.length; i += 400) {
      const batch = rows.slice(i, i + 400);
      const res = await publicRpc("apply_request_status_signed", {
        p_secret: process.env.TRADE_SHOW_STATUS_SECRET,
        p_legs: batch.map((x) => x.row),
        p_requests: [],
      });
      const ids = Array.isArray(res.applied_leg_ids) ? (res.applied_leg_ids as string[]) : [];
      for (const pid of ids) {
        const x = byPublic.get(pid);
        if (!x) continue;
        await sb.from("ship_request_legs").update({ pushed: x.row }).eq("id", x.crmLegId);
        applied++;
      }
    }

    if (closes.length) {
      await publicRpc("apply_request_status_signed", {
        p_secret: process.env.TRADE_SHOW_STATUS_SECRET,
        p_legs: [],
        p_requests: closes.map((c) => ({ id: c.public_request_id, status: "cancelled" })),
      });
      await sb.from("ship_request_inbox").update({ pushed_closed: true }).in("id", closes.map((c) => c.id));
    }
    return { ok: true, sent: rows.length, applied, closed: closes.length };
  } catch (e) {
    return { ok: false, sent: 0, applied: 0, closed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
