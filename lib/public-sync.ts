import { after } from "next/server";

/**
 * Nudge the public-site sync (n8n "DTS Trade Show Public Sync") so a verify,
 * revert, publish or partner cobranding change is live in seconds instead of
 * on the quarter hour. Fire
 * and forget after the response: the webhook carries no data, the sync reads
 * the export view itself, and the 15-minute schedule is the fallback if this
 * never arrives. Unset in an environment means no nudge, not an error.
 */
export function nudgePublicSync() {
  const url = process.env.N8N_TRADE_SHOW_SYNC_WEBHOOK_URL;
  if (!url) return;
  after(async () => {
    try {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {
      /* the schedule covers it */
    }
  });
}
