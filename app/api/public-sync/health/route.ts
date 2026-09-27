import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHealth, type SyncRun } from "@/lib/sync-health";

export const dynamic = "force-dynamic";

/**
 * Is the public-site sync healthy? n8n calls this hourly and emails the
 * ready-made subject and HTML when `alert` is true.
 *
 * Auth: `Authorization: Bearer <TMS_WEBHOOK_SECRET>` (same as the other n8n routes).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.TMS_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("public_sync_runs")
    .select("ran_at, trigger, ok, error")
    .order("ran_at", { ascending: false })
    .limit(50);
  if (error) {
    // Can't read the log: that's itself worth an email.
    return NextResponse.json({
      ok: true,
      status: "unknown",
      alert: true,
      subject: "Public show pages sync: can't read the run log",
      html: `<p>The CRM couldn't read public_sync_runs: ${error.message.replace(/</g, "&lt;")}</p>`,
    });
  }
  return NextResponse.json({ ok: true, ...syncHealth((data ?? []) as SyncRun[]) });
}
