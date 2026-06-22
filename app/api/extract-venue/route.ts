import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a freight logistics data extraction assistant. The user will paste raw text about a trade show / convention venue (e.g. a venue facilities page, a show's Quick Facts logistics section, or a freight/marshalling instructions sheet). Extract venue details and return ONLY a valid JSON object with no preamble, no markdown, no backticks. If a field cannot be determined from the text, set it to null. Fields: venue_name (the convention center / facility name), address (street address only), city, state (2-letter US abbreviation when possible), dock_notes (loading dock count, dimensions, dock height, marshalling yard details), union_rules (labor jurisdiction, what union labor is required for, work rules), delivery_restrictions (carrier check-in, marshalling/staging requirements, time/height/curfew limits, certificate of insurance requirements), parking_and_staging_notes (truck parking, staging area, POV parking), general_notes (only freight-relevant facts NOT already captured by the dock/union/delivery/parking fields above — keep it short and set to null if there is nothing additive). Combine related sentences into each notes field as readable prose; do not repeat the same fact across multiple fields.`;

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
 * Extracts New Venue fields from pasted text using Claude. Browser-called from
 * the New Venue import modal; the API key stays server-side and the route
 * requires an authenticated session.
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
    return NextResponse.json({ ok: false, error: "Paste some venue text first." }, { status: 400 });
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
