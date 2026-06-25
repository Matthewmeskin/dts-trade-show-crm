/**
 * POST /api/suggest  — given a cluster of shipment ids, gather their venue/
 * exhibitor/date clues and ask the AI (with web search) to identify the venue
 * and trade show and find its website / manual / dates. Auth-gated.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverTradeShow } from "@/lib/ai";

function mode<T>(vals: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) { n = c; best = v; }
  return best;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI isn't configured (set ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const ids = Array.isArray((body as { shipmentIds?: unknown })?.shipmentIds)
    ? ((body as { shipmentIds: unknown[] }).shipmentIds).map(String).filter(Boolean)
    : [];
  if (!ids.length) {
    return NextResponse.json({ ok: false, error: "No shipments provided" }, { status: 400 });
  }

  const { data: rows } = await supabase
    .from("shipments")
    .select("tms_venue_raw, tms_venue_city, tms_venue_state, pickup_date, show_date, exhibitor:exhibitors(company_name)")
    .in("id", ids);

  const list = rows ?? [];
  const venueTexts = [...new Set(list.map((r) => r.tms_venue_raw).filter(Boolean) as string[])].slice(0, 6);
  const exhibitors = [...new Set(list.map((r) => r.exhibitor?.company_name).filter(Boolean) as string[])].slice(0, 12);
  const dateHints = [...new Set(
    list.flatMap((r) => [r.show_date, r.pickup_date]).filter(Boolean).map((d) => (d as string).slice(0, 10)),
  )].slice(0, 12);
  const city = mode(list.map((r) => r.tms_venue_city).filter(Boolean) as string[]);
  const state = mode(list.map((r) => r.tms_venue_state).filter(Boolean) as string[]);

  const result = await discoverTradeShow({ city, state, venueTexts, exhibitors, dateHints });
  if (result.status === "unconfigured") {
    return NextResponse.json({ ok: false, error: "AI isn't configured." }, { status: 503 });
  }
  if (result.status === "error") {
    return NextResponse.json({ ok: false, error: result.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
