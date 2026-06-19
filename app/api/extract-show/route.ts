import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a freight logistics data extraction assistant. The user will paste raw text from a Freemanco trade show Quick Facts document. Extract all relevant fields and return ONLY a valid JSON object with no preamble, no markdown, no backticks. Use ISO 8601 date format (YYYY-MM-DD) for all dates. If a field cannot be determined from the text, set it to null. Fields: show_name, edition_year, industry_vertical, show_management_company, venue, primary_gsc_contact, show_start_date, show_end_date, move_in_start, move_in_end, move_out_start, move_out_end, advance_warehouse_open, advance_warehouse_cutoff, direct_to_show_start, direct_to_show_end, estimated_revenue, actual_revenue, competitor_notes, general_notes.`;

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
