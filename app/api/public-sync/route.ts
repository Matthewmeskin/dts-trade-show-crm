import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPublicSync, type SyncTrigger } from "@/lib/public-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The public-site sync, on a schedule. Vercel Cron calls this every 15
 * minutes (vercel.json) with `Authorization: Bearer <CRON_SECRET>`; a person
 * or n8n can also call it with the TMS webhook secret to force a run.
 * A failed run answers 500, so it shows as failed in Vercel's cron log.
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
  const result = await runPublicSync(trigger);
  if (!result.ok) console.error("[public-sync]", trigger, result.error);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
