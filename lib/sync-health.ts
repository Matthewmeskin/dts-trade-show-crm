import { formatPacificDateTime } from "@/lib/format";

/**
 * Is the public-site sync healthy? Read from the run log the sync writes
 * (public_sync_runs), for the hourly n8n check that emails when it isn't.
 *
 *   ok       the last run worked (or one blip, healed by the next run)
 *   failing  the last two runs in a row failed
 *   quiet    nothing has run for 45 minutes - the cron itself stopped
 *   never    no runs logged yet (a fresh deploy)
 *
 * The alert fires on the first hourly check after it goes bad, then every
 * 4 hours while it stays bad, so it nags without flooding the inbox. That
 * assumes the check runs once an hour on the hour, which is how the n8n
 * workflow is set.
 */

export type SyncRun = { ran_at: string; trigger: string; ok: boolean; error: string | null };

export type SyncHealth = {
  status: "ok" | "failing" | "quiet" | "never";
  lastRunAt: string | null;
  lastOkAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  /** When it became bad enough to alert on. */
  badSince: string | null;
  alert: boolean;
  subject: string;
  html: string;
};

/** The cron runs every 15 minutes; three missed runs in a row means it stopped. */
export const QUIET_MINUTES = 45;
export const REMIND_EVERY_HOURS = 4;

const MIN = 60_000;
const HOUR = 60 * MIN;

/** runs: newest first. */
export function syncHealth(runs: SyncRun[], now: Date = new Date()): SyncHealth {
  const last = runs[0] ?? null;
  const lastOk = runs.find((r) => r.ok) ?? null;
  let streak = 0;
  while (streak < runs.length && !runs[streak].ok) streak++;
  const lastError = runs.find((r) => !r.ok)?.error ?? null;

  let status: SyncHealth["status"] = "ok";
  let badSince: string | null = null;
  if (!last) status = "never";
  else if (now.getTime() - new Date(last.ran_at).getTime() > QUIET_MINUTES * MIN) {
    status = "quiet";
    badSince = new Date(new Date(last.ran_at).getTime() + QUIET_MINUTES * MIN).toISOString();
  } else if (streak >= 2) {
    status = "failing";
    // The second failure in the streak is when it stopped being a blip.
    badSince = runs[streak - 2].ran_at;
  }

  const alert =
    badSince != null && Math.floor((now.getTime() - new Date(badSince).getTime()) / HOUR) % REMIND_EVERY_HOURS === 0;

  const base = { status, lastRunAt: last?.ran_at ?? null, lastOkAt: lastOk?.ran_at ?? null, consecutiveFailures: streak, lastError, badSince, alert };
  return { ...base, ...render(base) };
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(h: Omit<SyncHealth, "subject" | "html">): { subject: string; html: string } {
  if (h.status === "ok" || h.status === "never") {
    return { subject: h.status === "ok" ? "Public show pages sync is working" : "Public show pages sync hasn't run yet", html: "" };
  }
  const subject =
    h.status === "failing"
      ? `Public show pages sync is failing (${h.consecutiveFailures} runs in a row)`
      : "Public show pages sync has stopped running";
  const what =
    h.status === "failing"
      ? `The last ${h.consecutiveFailures} runs failed.`
      : `Nothing has run since ${esc(formatPacificDateTime(h.lastRunAt))}. It normally runs every 15 minutes.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;font-size:14px;">
<p style="margin:0 0 10px;"><strong>${esc(subject)}.</strong> ${what}</p>
<p style="margin:0 0 10px;color:#334155;">Until it's fixed, shows verified in the CRM won't reach dtsone.com/trade-show/shipping, and changes to shows already live won't update. The pages that are up stay up.</p>
<table style="border-collapse:collapse;font-size:13px;margin:0 0 12px;">
<tr><td style="padding:3px 12px 3px 0;color:#64748b;">Last good run</td><td>${h.lastOkAt ? esc(formatPacificDateTime(h.lastOkAt)) : "None logged"}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#64748b;">Last run</td><td>${h.lastRunAt ? esc(formatPacificDateTime(h.lastRunAt)) : "—"}</td></tr>
${h.lastError ? `<tr><td style="padding:3px 12px 3px 0;color:#64748b;vertical-align:top;">Last error</td><td style="font-family:monospace;font-size:12px;">${esc(h.lastError.slice(0, 600))}</td></tr>` : ""}
</table>
<p style="margin:0 0 6px;color:#334155;">Where to look:</p>
<ul style="margin:0 0 10px;padding-left:18px;color:#334155;font-size:13px;">
<li>Vercel → dts-crm-test → Logs, filtered to <code>/api/public-sync</code> (and Settings → Cron Jobs, if it has stopped running).</li>
<li>An error naming a secret or "not authorized": the TRADE_SHOW_* env vars on dts-crm-test, or the sync key on the DTS Trade Show project.</li>
<li>A "signature" error: an export view changed and needs its reviewed signature updated.</li>
</ul>
<p style="margin:0;color:#64748b;font-size:12px;">This repeats every ${REMIND_EVERY_HOURS} hours until the sync is working again.</p>
</div>`;
  return { subject, html };
}
