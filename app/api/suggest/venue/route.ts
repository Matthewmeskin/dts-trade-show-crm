/**
 * POST /api/suggest/venue — AI-research a venue's freight logistics (web search)
 * for the given venueId and return suggested fields. Auth-gated.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverVenueLogistics } from "@/lib/ai";

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
  const venueId = String((body as { venueId?: unknown })?.venueId ?? "");
  if (!venueId) {
    return NextResponse.json({ ok: false, error: "No venue provided" }, { status: 400 });
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("venue_name, city, state")
    .eq("id", venueId)
    .single();
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue not found" }, { status: 404 });
  }

  const result = await discoverVenueLogistics({
    venue_name: venue.venue_name,
    city: venue.city,
    state: venue.state,
  });
  if (result.status === "unconfigured") {
    return NextResponse.json({ ok: false, error: "AI isn't configured." }, { status: 503 });
  }
  if (result.status === "error") {
    return NextResponse.json({ ok: false, error: result.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
