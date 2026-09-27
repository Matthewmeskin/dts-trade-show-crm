import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one-way sync to the public show pages (dtsone.com/trade-show/shipping),
 * run by the CRM itself - every 15 minutes from Vercel Cron (/api/public-sync)
 * and right after Verify, Revert, Publish or a cobranding change.
 *
 *   1. read   tradeshow.public_export() on DTS Database (service role, server only):
 *             exactly the rows of the reviewed export views
 *   2. apply  public.apply_export_signed / apply_partner_export_signed /
 *             apply_ship_export_signed (GSC Shipping Center) on the
 *             DTS Trade Show project, with its publishable key + the sync secret.
 *             The public project checks the secret against a stored SHA-256
 *             fingerprint, then reconciles with all its guards (column
 *             signature, runaway withdrawal, slug protection).
 *   3. revalidate the site's pages for the slugs touched.
 *
 * No service_role key for the public project exists anywhere in this. The
 * secrets live only in this project's Vercel env:
 *   TRADE_SHOW_SUPABASE_URL, TRADE_SHOW_SUPABASE_PUBLISHABLE_KEY,
 *   TRADE_SHOW_SYNC_SECRET, TRADE_SHOW_SITE_URL, TRADE_SHOW_REVALIDATE_SECRET.
 */

/** md5 of each export view's column names. The public side refuses a widened view. */
export const SHOW_EXPORT_SIG = "539191084e0eed1a285e2cb5b5e4b97a";
/**
 * The show export before it carried is_public and ship_enabled (export 008).
 * Accepted only for a row without those keys, so the CRM and the export
 * migration can deploy in either order. Remove once 008 is live.
 */
export const SHOW_EXPORT_SIG_BEFORE_FLAGS = "69e2b14b62548958d3acd661eaf52c24";
export const PARTNER_EXPORT_SIG = "0f6087d487a0bcffd359f1d01ddf095d";
export const SHIP_EXPORT_SIG = "3aaa83846b0c3d1453f5cc9c306723f4";

/** The signature to expect for this show export: null when there is nothing to check. */
export function showExportSig(rows: Record<string, unknown>[]): string | null {
  if (!rows.length) return null;
  return "is_public" in rows[0] ? SHOW_EXPORT_SIG : SHOW_EXPORT_SIG_BEFORE_FLAGS;
}

export type SyncTrigger = "schedule" | "on_verify" | "manual";

export type SyncResult = {
  ok: boolean;
  trigger: SyncTrigger;
  showRows: number;
  partnerRows: number;
  /** null until export 009 (ship_export) is live on DTS Database. */
  shipRows?: number | null;
  shows?: Record<string, unknown>;
  partners?: Record<string, unknown>;
  ship?: Record<string, unknown>;
  revalidated?: boolean;
  error?: string;
};

type Row = Record<string, unknown>;

export function syncConfigured(): boolean {
  return Boolean(
    process.env.TRADE_SHOW_SUPABASE_URL &&
      process.env.TRADE_SHOW_SUPABASE_PUBLISHABLE_KEY &&
      process.env.TRADE_SHOW_SYNC_SECRET &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** The slugs a run touched, for revalidation. */
export function slugsOf(shows: Row[], partners: Row[]): string[] {
  const out = new Set<string>();
  for (const r of shows) if (typeof r.slug === "string") out.add(r.slug);
  for (const r of partners) if (typeof r.show_slug === "string") out.add(r.show_slug);
  return [...out];
}

async function rpc(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${process.env.TRADE_SHOW_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: process.env.TRADE_SHOW_SUPABASE_PUBLISHABLE_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function runPublicSync(trigger: SyncTrigger): Promise<SyncResult> {
  const result = await runOnce(trigger);
  if (syncConfigured()) await logRun(result);
  return result;
}

/**
 * One row per run, for the health check that emails when the sync is failing
 * (lib/sync-health.ts). Best-effort: logging must never fail the sync.
 */
async function logRun(r: SyncResult) {
  try {
    const db = createAdminClient();
    await db.from("public_sync_runs").insert({
      trigger: r.trigger,
      ok: r.ok,
      show_rows: r.showRows,
      partner_rows: r.partnerRows,
      revalidated: r.revalidated ?? null,
      error: r.error?.slice(0, 2000) ?? null,
    });
    await db.from("public_sync_runs").delete().lt("ran_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  } catch (e) {
    console.error("[public-sync] couldn't log the run:", e instanceof Error ? e.message : e);
  }
}

async function runOnce(trigger: SyncTrigger): Promise<SyncResult> {
  if (!syncConfigured()) {
    return { ok: false, trigger, showRows: 0, partnerRows: 0, error: "Public sync is not configured on this deployment." };
  }
  let showRows: Row[] = [];
  let partnerRows: Row[] = [];
  try {
    const { data, error } = await createAdminClient().rpc("public_export" as never);
    if (error) throw new Error(`public_export: ${error.message}`);
    const exported = (data ?? {}) as { shows?: Row[]; partners?: Row[]; ship?: Row[]; ship_codes?: Row[] };
    showRows = exported.shows ?? [];
    partnerRows = exported.partners ?? [];

    // Shows first: a cobranded page only exists for a show that does.
    const shows = await rpc("apply_export_signed", {
      p_secret: process.env.TRADE_SHOW_SYNC_SECRET,
      p_rows: showRows,
      p_trigger_source: trigger,
      // An empty export has no columns to check; requiring a signature there
      // would stop the last show from ever coming down.
      p_expected_sig: showExportSig(showRows),
    });
    const partners = await rpc("apply_partner_export_signed", {
      p_secret: process.env.TRADE_SHOW_SYNC_SECRET,
      p_rows: partnerRows,
      p_expected_sig: partnerRows.length ? PARTNER_EXPORT_SIG : null,
    });
    // GSC Shipping Center: after the shows, whose editions it points at. Never
    // deletes on the public side; a row that leaves the export is switched off.
    let ship: Record<string, unknown> | undefined;
    const shipRows = exported.ship ?? null;
    if (shipRows) {
      ship = await rpc("apply_ship_export_signed", {
        p_secret: process.env.TRADE_SHOW_SYNC_SECRET,
        p_rows: shipRows,
        p_codes: exported.ship_codes ?? [],
        p_expected_sig: shipRows.length ? SHIP_EXPORT_SIG : null,
      });
    }

    let revalidated = false;
    const site = process.env.TRADE_SHOW_SITE_URL;
    const secret = process.env.TRADE_SHOW_REVALIDATE_SECRET;
    if (site && secret) {
      const res = await fetch(`${site}/api/revalidate`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify({ slugs: slugsOf(showRows, partnerRows) }),
        signal: AbortSignal.timeout(30_000),
      });
      // The data is applied either way; pages still refresh on their hourly timer.
      revalidated = res.ok;
    }
    return {
      ok: true,
      trigger,
      showRows: showRows.length,
      partnerRows: partnerRows.length,
      shipRows: shipRows ? shipRows.length : null,
      shows,
      partners,
      ship,
      revalidated,
    };
  } catch (e) {
    return {
      ok: false,
      trigger,
      showRows: showRows.length,
      partnerRows: partnerRows.length,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Run the sync right after a verify, revert, publish or cobranding change, so
 * it's live in seconds instead of on the quarter hour. After the response, so
 * the button never waits on it; the schedule is the fallback if it fails.
 */
export function nudgePublicSync() {
  if (!syncConfigured()) return;
  after(async () => {
    const r = await runPublicSync("on_verify");
    if (!r.ok) console.error("[public-sync] on_verify failed:", r.error);
  });
}
