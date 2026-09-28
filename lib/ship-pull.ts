import { createAdminClient } from "@/lib/supabase/admin";
import { publicRpc } from "@/lib/public-sync";
import { exhibitorPatch, inboxRow, legPatch, legRows, type Known, type PulledRequest } from "@/lib/ship-intake";

/**
 * Bring confirmed GSC Shipping Center requests into the CRM's inbox.
 *
 * Runs inside the 15 minute public-site sync (/api/public-sync), and on
 * "Check now" in the inbox. The public project sends every confirmed request
 * the CRM has not acknowledged; the CRM stores each one (by its public id, so
 * a repeat does nothing), then acknowledges only what it stored. A run that
 * fails halfway just repeats next time.
 *
 * Env: TRADE_SHOW_SUPABASE_URL, TRADE_SHOW_SUPABASE_PUBLISHABLE_KEY (shared
 * with the sync), TRADE_SHOW_PULL_SECRET (this pull's own secret; the public
 * project stores its SHA-256 as purpose 'crm_pull'), SUPABASE_SERVICE_ROLE_KEY.
 */

export type PullResult = { ok: boolean; skipped?: boolean; received: number; stored: number; error?: string };

export function pullConfigured(): boolean {
  return Boolean(
    process.env.TRADE_SHOW_SUPABASE_URL &&
      process.env.TRADE_SHOW_SUPABASE_PUBLISHABLE_KEY &&
      process.env.TRADE_SHOW_PULL_SECRET &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function pullShipRequests(): Promise<PullResult> {
  if (!pullConfigured()) return { ok: true, skipped: true, received: 0, stored: 0 };
  const sb = createAdminClient();
  let received = 0;
  const stored: { id: string; version: number }[] = [];
  let error: string | undefined;

  try {
    const res = await publicRpc("pull_confirmed_requests_signed", {
      p_secret: process.env.TRADE_SHOW_PULL_SECRET,
      p_limit: 50,
    });
    const requests = (Array.isArray(res.requests) ? res.requests : []) as PulledRequest[];
    received = requests.length;

    if (requests.length) {
      const partnerIds = [...new Set(requests.map((r) => r.partner_id))];
      const showIds = [...new Set(requests.map((r) => r.show_id))];
      const [partners, shows, pairs] = await Promise.all([
        sb.from("partners").select("id").in("id", partnerIds),
        sb.from("shows").select("id").in("id", showIds),
        sb.from("ship_shows").select("partner_id, show_id").in("partner_id", partnerIds),
      ]);
      const failed = partners.error ?? shows.error ?? pairs.error;
      if (failed) throw new Error(failed.message);
      const known: Known = {
        partners: new Set((partners.data ?? []).map((p) => p.id)),
        shows: new Set((shows.data ?? []).map((s) => s.id)),
        shipShows: new Set((pairs.data ?? []).map((p) => `${p.partner_id}:${p.show_id}`)),
      };

      for (const r of requests) {
        // Insert once; a request already here (an earlier run stored it but
        // the ack failed) is left exactly as staff have it.
        const ins = await sb
          .from("ship_request_inbox")
          .upsert(inboxRow(r, known), { onConflict: "public_request_id", ignoreDuplicates: true });
        if (ins.error) {
          error = `request ${r.public_ref}: ${ins.error.message}`;
          continue;
        }
        const { data: row, error: readErr } = await sb
          .from("ship_request_inbox")
          .select("id, exhibitor_version, closed")
          .eq("public_request_id", r.id)
          .single();
        if (readErr || !row) {
          error = `request ${r.public_ref}: ${readErr?.message ?? "not stored"}`;
          continue;
        }
        const legs = legRows(r, row.id);
        if (legs.length) {
          const l = await sb.from("ship_request_legs").upsert(legs, { onConflict: "public_leg_id", ignoreDuplicates: true });
          if (l.error) {
            error = `legs of ${r.public_ref}: ${l.error.message}`;
            continue;
          }
        }

        // A newer version: the exhibitor approved, edited, cancelled or asked
        // for a change since the CRM last heard.
        const version = r.version ?? 1;
        if (version > row.exhibitor_version) {
          const up = await sb.from("ship_request_inbox").update(exhibitorPatch(r, known, row)).eq("id", row.id);
          if (up.error) {
            error = `update of ${r.public_ref}: ${up.error.message}`;
            continue;
          }
          const { data: have } = await sb.from("ship_request_legs").select("id, public_leg_id, stage").eq("request_id", row.id);
          const byPublic = new Map((have ?? []).map((h) => [h.public_leg_id, h]));
          let legFailed = false;
          for (const l of r.legs) {
            const mine = byPublic.get(l.id);
            if (!mine) continue;
            const lu = await sb.from("ship_request_legs").update(legPatch(l, mine.stage)).eq("id", mine.id);
            if (lu.error) {
              error = `leg of ${r.public_ref}: ${lu.error.message}`;
              legFailed = true;
            }
          }
          if (legFailed) continue;
        }
        if (r.changes?.length) {
          const ch = await sb.from("ship_change_requests").upsert(
            r.changes.map((c) => ({ request_id: row.id, public_change_id: c.id, message: c.message, requested_at: c.at })),
            { onConflict: "public_change_id", ignoreDuplicates: true },
          );
          if (ch.error) {
            error = `changes of ${r.public_ref}: ${ch.error.message}`;
            continue;
          }
        }
        stored.push({ id: r.id, version });
      }

      if (stored.length) {
        // Acknowledge the version each request had when pulled (slice 5), so
        // an exhibitor action made since comes back next time.
        await publicRpc("ack_requests_signed", { p_secret: process.env.TRADE_SHOW_PULL_SECRET, p_acks: stored });
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const ok = !error;
  const now = new Date().toISOString();
  await sb
    .from("ship_pull_state")
    .update({ last_run_at: now, ...(ok ? { last_ok_at: now } : {}), last_count: stored.length, last_error: error ?? null })
    .eq("id", 1)
    .then(
      () => undefined,
      () => undefined,
    );
  return { ok, received, stored: stored.length, ...(error ? { error } : {}) };
}
