import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a freight logistics data extraction assistant. The user will paste raw text from a Freemanco trade show Quick Facts document. Extract all relevant fields and return ONLY a valid JSON object with no preamble, no markdown, no backticks. Use ISO 8601 date format (YYYY-MM-DD) for all dates. If a field cannot be determined from the text, set it to null. Fields: show_name, edition_year, industry_vertical, show_management_company, venue, primary_gsc_contact, show_start_date, show_end_date, move_in_start, move_in_end, move_out_start, move_out_end, advance_warehouse_open, advance_warehouse_cutoff, advance_warehouse_name, advance_warehouse_care_of, advance_warehouse_street1, advance_warehouse_street2, advance_warehouse_city, advance_warehouse_state, advance_warehouse_zip, advance_warehouse_country, direct_to_show_start, direct_to_show_end, direct_to_show_name, direct_to_show_care_of, direct_to_show_street1, direct_to_show_street2, direct_to_show_city, direct_to_show_state, direct_to_show_zip, direct_to_show_country, estimated_revenue, actual_revenue, competitor_notes, general_notes.

Break each freight delivery address into its parts. For the advance/receiving warehouse use the advance_warehouse_* fields; for the show-site/venue delivery use the direct_to_show_* fields. For each: *_name is the ship-to / recipient line (often a placeholder like "Exhibiting Company Name / Booth Number" — keep it if present); *_care_of is the handling agent / consignee line (e.g. "C/O Freeman" or "C/O PDS / Freeman"); *_street1 is the street address (with suite if on the same line) and *_street2 any second street line; *_city, *_state, *_zip, *_country are the city, state/province, postal code, and country. Do NOT include the show name line or instructional placeholders in the street/city fields.

general_notes must be SHORT and contain ONLY freight-relevant facts that are NOT already represented by the structured fields above. Do NOT restate show/move-in/move-out/warehouse dates or their daily hours, or the advance-warehouse / show-site addresses — those live in the structured fields. Only include distinct operational notes that affect freight planning, e.g. carpet is mandatory, no return-to-warehouse at show close (must ship from show site), carrier check-in deadlines, overtime/labor-rate rules, the official carrier/GSC, special shipping programs/discounts, or who will/won't act as Importer of Record. Use a few terse bullet-like sentences; omit anything redundant; set to null if there is nothing genuinely additive.`;

/** Pull a JSON object out of the model's reply (tolerant of fences / stray text). */
function parseJson(raw: string): Record<string, unknown> | null {
  let s = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Extracts New Show fields from pasted Freeman Quick Facts text using Claude.
 * Browser-called from the New Show import modal; the API key stays server-side
 * and the route requires an authenticated session.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI extraction isn't configured (set ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "Paste some Quick Facts text first." }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text.slice(0, 24000) }],
    });
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const fields = parseJson(raw);
    if (!fields) {
      return NextResponse.json({ ok: false, error: "Could not parse the AI response." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
