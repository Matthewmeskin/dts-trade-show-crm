import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.TMS_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Returns the load numbers (tms_reference_id) of shipments the CRM wants live
 * tracking for: every load that isn't delivered, plus any load whose pickup is
 * within the last ~30 days or whose show date is still upcoming — even if the
 * CRM already marked it delivered — so a status/date reversal in the TMS keeps
 * syncing instead of freezing. n8n reads this, then queries Hyperion's Global
 * Tracking endpoint for each and posts the results back to /api/tms/shipments.
 *
 * Auth: `Authorization: Bearer <TMS_WEBHOOK_SECRET>` (same as the ingest).
 */
export async function GET(req: NextRequest) {
  if (!process.env.TMS_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "TMS ingest is not configured (set TMS_WEBHOOK_SECRET)." },
      { status: 503 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  // Poll everything still active — PLUS any recently- or future-active load even
  // if the CRM already marked it delivered — so a TMS reversal (a load that
  // flips back to dispatched, or has its pickup date changed after "delivery")
  // is caught instead of frozen. Only genuinely old, past-show delivered loads
  // fall out of the poll set.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("shipments")
    .select("tms_reference_id, status")
    .not("tms_reference_id", "is", null)
    .or(`status.neq.delivered,pickup_date.gte.${cutoff},show_date.gte.${today}`);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const loadNumbers = [
    ...new Set(
      (data ?? [])
        .map((r) => r.tms_reference_id)
        .filter((x): x is string => !!x && x.trim() !== ""),
    ),
  ];

  return NextResponse.json({ ok: true, count: loadNumbers.length, loadNumbers });
}
