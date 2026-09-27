import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one-way sync to the public show pages (dtsone.com/trade-show/shipping),
 * run by the CRM itself - every 15 minutes from Vercel Cron (/api/public-sync)
 * and right after Verify, Revert, Publish or a cobranding change.
 *
 *   1. read   tradeshow.public_export() on DTS Database (service role, server only):
 *             exactly the rows of the two reviewed export views
 *   2. apply  public.apply_export_signed / apply_partner_export_signed on the
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
export const SHOW_EXPORT_SIG = "69e2b14b62548958d3acd661eaf52c24";
export const PARTNER_EXPORT_SIG = "0f6087d487a0bcffd359f1d01ddf095d";

export type SyncTrigger = "schedule" | "on_verify" | "manual";

export type SyncResult = {
  ok: boolean;
  trigger: SyncTrigger;
  showRows: number;
  partnerRows: number;
  shows?: Record<string, unknown>;
  partners?: Record<string, unknown>;
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
  if (!syncConfigured()) {
    return { ok: false, trigger, showRows: 0, partnerRows: 0, error: "Public sync is not configured on this deployment." };
  }
  let showRows: Row[] = [];
  let partnerRows: Row[] = [];
  try {
    const { data, error } = await createAdminClient().rpc("public_export" as never);
    if (error) throw new Error(`public_export: ${error.message}`);
    const exported = (data ?? {}) as { shows?: Row[]; partners?: Row[] };
    showRows = exported.shows ?? [];
    partnerRows = exported.partners ?? [];

    // Shows first: a cobranded page only exists for a show that does.
    const shows = await rpc("apply_export_signed", {
      p_secret: process.env.TRADE_SHOW_SYNC_SECRET,
      p_rows: showRows,
      p_trigger_source: trigger,
      // An empty export has no columns to check; requiring a signature there
      // would stop the last show from ever coming down.
      p_expected_sig: showRows.length ? SHOW_EXPORT_SIG : null,
    });
    const partners = await rpc("apply_partner_export_signed", {
      p_secret: process.env.TRADE_SHOW_SYNC_SECRET,
      p_rows: partnerRows,
      p_expected_sig: partnerRows.length ? PARTNER_EXPORT_SIG : null,
    });

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
    return { ok: true, trigger, showRows: showRows.length, partnerRows: partnerRows.length, shows, partners, revalidated };
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
