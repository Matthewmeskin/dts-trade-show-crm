import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Supabase's default max-rows per request.
const PAGE_SIZE = 1000;

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
 * tracking for — i.e. every shipment a coordinator has tagged with a Brokerware
 * load number that isn't delivered yet. n8n reads this, then queries Hyperion's
 * Global Tracking endpoint for each and posts the results back to /api/tms/shipments.
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

  // PostgREST caps a single select at 1,000 rows and, without an order, which
  // 1,000 come back is arbitrary. With more than that many tracked shipments the
  // sync would silently skip a different ~10% of loads on every run, so page
  // through the whole set in a stable order.
  const rows: { tms_reference_id: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("shipments")
      .select("tms_reference_id")
      .not("tms_reference_id", "is", null)
      .neq("status", "delivered")
      .order("tms_reference_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
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
