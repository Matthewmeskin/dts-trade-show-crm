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
