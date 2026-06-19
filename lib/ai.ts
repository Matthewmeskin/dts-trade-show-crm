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
