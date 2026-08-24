import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";

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
  // Poll every non-delivered load, PLUS any delivered load whose show hasn't
  // happened yet — so a TMS reversal (a load flipped back to dispatched, or
  // re-dated / cancelled after "delivery", while its show is still upcoming) is
  // caught instead of frozen. fetchAll pages past PostgREST's 1,000-row cap so
  // the poll set is never silently truncated.
  const today = new Date().toISOString().slice(0, 10);
  let rows: { tms_reference_id: string | null }[];
  try {
    rows = await fetchAll<{ tms_reference_id: string | null }>(() =>
      supabase
        .from("shipments")
        .select("tms_reference_id")
        .not("tms_reference_id", "is", null)
        .or(`status.neq.delivered,show_date.gte.${today}`),
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }

  const loadNumbers = [
    ...new Set(
      rows
        .map((r) => r.tms_reference_id)
        .filter((x): x is string => !!x && x.trim() !== ""),
    ),
  ];

  return NextResponse.json({ ok: true, count: loadNumbers.length, loadNumbers });
}
