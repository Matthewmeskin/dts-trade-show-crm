import Anthropic from "@anthropic-ai/sdk";
import type { DashboardData } from "@/lib/dashboard";
import { formatDateRange, formatCountdown } from "@/lib/format";

export type SummaryResult =
  | { status: "ok"; summary: string }
  | { status: "unconfigured" }
  | { status: "empty" }
  | { status: "error"; message: string };

/** Compact, model-friendly snapshot of the current operational picture. */
function buildSnapshot(data: DashboardData): string {
  const f = data.featured!;
  const rollupCounts = data.exhibitorStatuses.reduce(
    (acc, e) => {
      acc[e.color] += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 } as Record<"green" | "yellow" | "red", number>,
  );

  return JSON.stringify(
    {
      show: {
        name: f.show_name,
        edition: f.edition_year,
        status: f.status,
        venue: [f.venueName, f.venueCity, f.venueState].filter(Boolean).join(", ") || null,
        dates: formatDateRange(f.move_in_start, f.move_out_end),
        next_deadline: f.deadline
          ? `${f.deadline.label} ${formatCountdown(f.deadline.days)} (${f.deadline.date})`
          : null,
      },
      shipments: data.shipmentSummary,
      exhibitors: {
        total: data.exhibitorStatuses.length,
        on_track: rollupCounts.green,
        in_progress: rollupCounts.yellow,
        needs_attention: rollupCounts.red,
        flagged: data.exhibitorStatuses
          .filter((e) => e.color === "red")
          .map((e) => `${e.companyName} (${e.shipmentCount} shipments)`),
      },
      alerts: {
        advance_warehouse_cutoffs: data.alerts.cutoffs.map(
          (c) => `${c.showName}: cutoff ${formatCountdown(c.days)}`,
        ),
        move_in_delivery_risks: data.alerts.deliveryRisks.map(
          (d) =>
            `${d.exhibitor ?? "shipment"} move-in ${d.health}${d.show ? ` for ${d.show}` : ""} (due ${formatCountdown(d.days)})`,
        ),
        flagged_issues: data.alerts.issues.map((s) => `${s.exhibitor ?? "shipment"} on ${s.show ?? "?"}`),
        quoted_near_pickup: data.alerts.quotedNearPickup.map(
          (s) => `${s.exhibitor ?? "shipment"} pickup ${formatCountdown(s.days)}`,
        ),
      },
      open_tasks: data.openTasks.map((t) => ({
        title: t.title,
        due: formatCountdown(t.days),
        priority: t.priority,
        assignee: t.assignee,
      })),
      upcoming_shows: data.upcomingShows.map((s) => ({
        name: s.show_name,
        advance_cutoff: formatCountdown(s.cutoffDays),
      })),
    },
    null,
    2,
  );
}

const SYSTEM_PROMPT = `You are an operations assistant for DTS, a freight brokerage's trade show division. You write tight, plain-English situational-awareness summaries for the ops team from live show data.

Rules:
- 3-5 sentences, one paragraph. No preamble, no headings, no bullet lists.
- Lead with whatever most needs attention (cutoffs, flagged issues, overdue tasks).
- Be specific with names, counts, and timing; use the data, don't invent anything.
- If things are calm, say so briefly. Write for a freight coordinator who knows the jargon.`;

export type LoadInput = {
  load_number: string;
  mode?: string | null;
  pickup_location?: string | null;
  delivery_location?: string | null;
};

export type LoadVerdict = {
  load_number: string;
  is_candidate: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
  venue: string | null;
};

export type ClassifyResult =
  | { status: "ok"; verdicts: LoadVerdict[] }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

const CLASSIFY_SYSTEM = `You identify TRADE-SHOW freight for DTS, a freight brokerage's trade show division. Given TMS loads (pickup/delivery addresses + mode), decide which are trade-show shipments.

A load IS a trade-show shipment if any of these hold:
- Pickup OR delivery is a convention center, expo/exhibition hall, fairgrounds, civic/conference center, or arena used for shows (e.g. "McCormick Place", "Las Vegas Convention Center", "Orange County Convention Center", "Javits", "Mandalay Bay", "Sands Expo").
- The address references a booth, hall, exhibit space, or show name (e.g. "Booth #4249", "Hall C", "c/o <show>").
- The mode signals trade show (e.g. "TradeshowLTL", "Tradeshow Truckload").
Use the provided venue list as strong hints — a match there is high confidence.

Be decisive but don't over-flag ordinary commercial/residential freight. For each load return is_candidate, confidence (high/medium/low), a one-sentence reason citing the specific signal, and the matched venue name (or null).`;

export async function classifyTradeShowLoads(
  loads: LoadInput[],
  knownVenues: string[] = [],
): Promise<ClassifyResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "unconfigured" };
  if (loads.length === 0) return { status: "ok", verdicts: [] };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: CLASSIFY_SYSTEM,
      tools: [
        {
          name: "record_classifications",
          description: "Record the trade-show classification for every load provided.",
          input_schema: {
            type: "object",
            properties: {
              classifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    load_number: { type: "string" },
                    is_candidate: { type: "boolean" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    reason: { type: "string" },
                    venue: { type: ["string", "null"] },
                  },
                  required: ["load_number", "is_candidate", "confidence", "reason"],
                },
              },
            },
            required: ["classifications"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_classifications" },
      messages: [
        {
          role: "user",
          content: `Known venues: ${knownVenues.length ? knownVenues.join("; ") : "(none on file)"}\n\nClassify these loads:\n${JSON.stringify(loads)}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const raw = (toolUse?.input as { classifications?: unknown })?.classifications;
    if (!Array.isArray(raw)) return { status: "error", message: "No classifications returned." };

    const verdicts: LoadVerdict[] = raw
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
      .map((v) => ({
        load_number: String(v.load_number ?? ""),
        is_candidate: v.is_candidate === true,
        confidence: (["high", "medium", "low"].includes(String(v.confidence))
          ? v.confidence
          : "low") as LoadVerdict["confidence"],
        reason: String(v.reason ?? ""),
        venue: v.venue == null ? null : String(v.venue),
      }))
      .filter((v) => v.load_number);

    return { status: "ok", verdicts };
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return { status: "error", message };
  }
}

/* -------------------------------------------------------------------------- */
/* Trade-show discovery (web search)                                           */
/* -------------------------------------------------------------------------- */

export type DiscoveredShow = {
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  show_name: string | null;
  edition_year: number | null;
  website_url: string | null;
  exhibitor_manual_url: string | null;
  exhibitor_list_url: string | null;
  show_start_date: string | null;
  show_end_date: string | null;
  move_in_start: string | null;
  move_out_end: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
  sources: string[];
};

export type DiscoverResult =
  | { status: "ok"; data: DiscoveredShow }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

const DISCOVER_SYSTEM = `You research trade shows for DTS, a freight brokerage's trade show division. You are given freight clues about shipments going to ONE trade show: messy venue text from shipping labels, a city/state, exhibitor company names, and freight date hints. Use web search to identify (a) the VENUE and (b) the specific TRADE SHOW happening there on those dates.

Search the web to find the show's official website, exhibitor/service manual (the "exhibitor kit" or "freight/shipping" PDF or page), and exhibitor list if available. Prefer the official show site and the general service contractor (Freeman, GES, etc.) pages.

Return ONLY a JSON object (no markdown, no preamble) with these keys, using null when unsure:
{
 "venue_name","venue_address","venue_city","venue_state",
 "show_name","edition_year",
 "website_url","exhibitor_manual_url","exhibitor_list_url",
 "show_start_date","show_end_date","move_in_start","move_out_end",  // ISO YYYY-MM-DD
 "confidence","notes","sources"  // confidence: high|medium|low; sources: array of URLs you used
}
Only assert a show_name and dates you can corroborate from search results near the freight dates and city. Do not invent URLs.`;

/** Pull a JSON object out of the model's reply (tolerant of fences / stray text). */
function looseJson(raw: string): Record<string, unknown> | null {
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

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const conf = (v: unknown): "high" | "medium" | "low" =>
  v === "high" || v === "medium" || v === "low" ? v : "low";

export async function discoverTradeShow(input: {
  city: string | null;
  state: string | null;
  venueTexts: string[];
  exhibitors: string[];
  dateHints: string[];
}): Promise<DiscoverResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "unconfigured" };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: DISCOVER_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [
        {
          role: "user",
          content: `Freight clues for one trade show:\n- City/State: ${[input.city, input.state].filter(Boolean).join(", ") || "(unknown)"}\n- Venue text from labels:\n${input.venueTexts.map((t) => `  • ${t}`).join("\n") || "  (none)"}\n- Exhibitors shipping in: ${input.exhibitors.join(", ") || "(unknown)"}\n- Freight date hints: ${input.dateHints.join(", ") || "(unknown)"}\n\nIdentify the venue and the show, then return the JSON object.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const j = looseJson(text);
    if (!j) return { status: "error", message: "Could not parse the AI response." };

    const sources = Array.isArray(j.sources)
      ? (j.sources as unknown[]).map((x) => String(x)).filter(Boolean).slice(0, 8)
      : [];
    const year = Number.parseInt(String(j.edition_year ?? ""), 10);

    return {
      status: "ok",
      data: {
        venue_name: str(j.venue_name),
        venue_address: str(j.venue_address),
        venue_city: str(j.venue_city) ?? input.city,
        venue_state: str(j.venue_state) ?? input.state,
        show_name: str(j.show_name),
        edition_year: Number.isFinite(year) ? year : null,
        website_url: str(j.website_url),
        exhibitor_manual_url: str(j.exhibitor_manual_url),
        exhibitor_list_url: str(j.exhibitor_list_url),
        show_start_date: str(j.show_start_date),
        show_end_date: str(j.show_end_date),
        move_in_start: str(j.move_in_start),
        move_out_end: str(j.move_out_end),
        confidence: conf(j.confidence),
        notes: str(j.notes),
        sources,
      },
    };
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return { status: "error", message };
  }
}

export type DiscoveredVenue = {
  address: string | null;
  city: string | null;
  state: string | null;
  dock_notes: string | null;
  union_rules: string | null;
  delivery_restrictions: string | null;
  parking_and_staging_notes: string | null;
  general_notes: string | null;
  confidence: "high" | "medium" | "low";
  sources: string[];
};

export type DiscoverVenueResult =
  | { status: "ok"; data: DiscoveredVenue }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

const VENUE_SYSTEM = `You research convention-center / trade-show venue FREIGHT logistics for DTS, a freight brokerage. Given a venue name and city/state, use web search to find the venue's official freight/exhibitor-logistics info (loading docks, marshalling yard, union/labor rules, delivery restrictions, certificate/insurance requirements, parking & staging).

Return ONLY a JSON object (no markdown, no preamble), null when unsure:
{
 "address","city","state",
 "dock_notes",                 // # of docks, dimensions, marshalling yard, dock height
 "union_rules",                // labor jurisdiction / work rules for freight handling
 "delivery_restrictions",      // carrier check-in, time windows, height/weight limits, COI requirements
 "parking_and_staging_notes",
 "general_notes",              // other freight-relevant facts
 "confidence","sources"        // confidence: high|medium|low; sources: array of URLs
}
Keep each notes field concise and freight-relevant. Only state facts you can corroborate from search results.`;

export async function discoverVenueLogistics(input: {
  venue_name: string;
  city: string | null;
  state: string | null;
}): Promise<DiscoverVenueResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "unconfigured" };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: VENUE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [
        {
          role: "user",
          content: `Venue: ${input.venue_name}${[input.city, input.state].filter(Boolean).length ? ` (${[input.city, input.state].filter(Boolean).join(", ")})` : ""}\n\nFind its freight/exhibitor logistics and return the JSON object.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const j = looseJson(text);
    if (!j) return { status: "error", message: "Could not parse the AI response." };

    const sources = Array.isArray(j.sources)
      ? (j.sources as unknown[]).map((x) => String(x)).filter(Boolean).slice(0, 8)
      : [];
    return {
      status: "ok",
      data: {
        address: str(j.address),
        city: str(j.city) ?? input.city,
        state: str(j.state) ?? input.state,
        dock_notes: str(j.dock_notes),
        union_rules: str(j.union_rules),
        delivery_restrictions: str(j.delivery_restrictions),
        parking_and_staging_notes: str(j.parking_and_staging_notes),
        general_notes: str(j.general_notes),
        confidence: conf(j.confidence),
        sources,
      },
    };
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return { status: "error", message };
  }
}

export async function generateSituationSummary(
  data: DashboardData,
): Promise<SummaryResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "unconfigured" };
  if (!data.featured) return { status: "empty" };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the live picture for the current show. Write the situational summary.\n\n${buildSnapshot(data)}`,
        },
      ],
    });

    const summary = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!summary) return { status: "error", message: "Empty response from the model." };
    return { status: "ok", summary };
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `${e.status ?? ""} ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return { status: "error", message };
  }
}
