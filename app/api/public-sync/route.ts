import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPublicSync, type SyncTrigger } from "@/lib/public-sync";
import { pullShipRequests } from "@/lib/ship-pull";
import { pushShipStatus } from "@/lib/ship-push";
import { runShipMail } from "@/lib/ship-mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The public-site sync, on a schedule. Vercel Cron calls this every 15
 * minutes (vercel.json) with `Authorization: Bearer <CRON_SECRET>`; a person
 * or n8n can also call it with the TMS webhook secret to force a run.
 * A failed run answers 500, so it shows as failed in Vercel's cron log.
 *
 * The same run pulls confirmed GSC Shipping Center requests into the CRM's
 * inbox (lib/ship-pull.ts). The two are independent: one failing never stops
 * the other. After the pull, each leg's status goes back to the exhibitor's
 * status page (lib/ship-push.ts), so it pushes against what was just pulled;
 * then the Shipping Center's scheduled email (lib/ship-mailer.ts): the GSC's
 * manifest and outbound list, and the exhibitor reminders.
 */
function matches(provided: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const fromCron = matches(token, process.env.CRON_SECRET);
  if (!fromCron && !matches(token, process.env.TMS_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const trigger: SyncTrigger = fromCron ? "schedule" : "manual";
  const [result, [pull, push, mail]] = await Promise.all([
    runPublicSync(trigger),
    pullShipRequests().then(async (p) => [p, await pushShipStatus(), await runShipMail()] as const),
  ]);
  if (!result.ok) console.error("[public-sync]", trigger, result.error);
  if (!pull.ok) console.error("[ship-pull]", trigger, pull.error);
  if (!push.ok) console.error("[ship-push]", trigger, push.error);
  if (!mail.ok) console.error("[ship-mail]", trigger, mail.error);
  // A reminder that did not send is retried next run; it does not fail the sync.
  return NextResponse.json({ ...result, pull, push, mail }, { status: result.ok && pull.ok && push.ok ? 200 : 500 });
}
