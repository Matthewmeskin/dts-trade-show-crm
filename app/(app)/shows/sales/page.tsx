import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { DateRangeFields } from "@/components/date-range-fields";
import { formatDate } from "@/lib/format";
import { showMilestones, MILESTONE_META, type SalesMilestone } from "@/lib/sales";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sales calendar · DTS Trade Show CRM" };

/** Human "in 5 days" / "today" / "3 days ago" from a YYYY-MM-DD vs today. */
function relativeLabel(date: string, todayMs: number): string {
  const d = new Date(`${date}T00:00:00Z`).getTime();
  const days = Math.round((d - todayMs) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export default async function SalesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; done?: string }>;
}) {
  const { from = "", to = "", done = "" } = await searchParams;
  const supabase = await createClient();

  const { data: shows } = await supabase
    .from("shows")
    .select(
      "id, show_name, show_start_date, lead_gen_owner, lead_gen_start_date, lead_gen_completion_date, emailed_two_weeks, instantly_created, archived",
    )
    .eq("archived", false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  // Default window: from today onward, unless the operator picks a range.
  const lo = from || (to ? "" : todayStr);
  const showDone = done === "1";

  const milestones = (shows ?? [])
    .flatMap(showMilestones)
    .filter((m) => (lo ? m.date >= lo : true) && (to ? m.date <= to : true))
    .filter((m) => (showDone ? true : !m.done))
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

  // Group by date for the agenda.
  const byDate = new Map<string, SalesMilestone[]>();
  for (const m of milestones) {
    const g = byDate.get(m.date) ?? [];
    g.push(m);
    byDate.set(m.date, g);
  }
  const dates = [...byDate.keys()];

  return (
    <div>
      <PageHeader
        title="Sales calendar"
        description="Lead-gen and outreach milestones across your shows, in date order."
      />

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href="/shows" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
          Shows
        </Link>
        <span className="rounded-lg bg-dts-maroon px-3 py-1.5 text-sm font-medium text-white">Sales calendar</span>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <DateRangeFields from={from} to={to} label="Window" />
        <Link
          href={`/shows/sales${(() => { const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); if (!showDone) p.set("done", "1"); return p.toString() ? `?${p}` : ""; })()}`}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${showDone ? "border-dts-maroon bg-dts-maroon/5 text-dts-maroon" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
        >
          {showDone ? "✓ Showing completed" : "Show completed"}
        </Link>
        {showDone ? <input type="hidden" name="done" value="1" /> : null}
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
        {from || to ? (
          <Link
            href={`/shows/sales${(() => { const p = new URLSearchParams(); if (showDone) p.set("done", "1"); return p.toString() ? `?${p}` : ""; })()}`}
            className="text-sm font-medium text-slate-400 hover:text-slate-700"
          >
            Clear window
          </Link>
        ) : null}
      </form>

      <Card>
        {dates.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No sales milestones"
            description="Add show start dates and lead-gen details on your shows to populate the sales calendar."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {dates.map((date) => (
              <li key={date} className="px-5 py-3">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-heading text-sm font-semibold text-slate-900">{formatDate(date)}</span>
                  <span className="text-xs text-slate-400">{relativeLabel(date, todayMs)}</span>
                </div>
                <ul className="space-y-1.5">
                  {byDate.get(date)!.map((m, i) => {
                    const meta = MILESTONE_META[m.kind];
                    return (
                      <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge className={`${meta.badge} ${m.done ? "opacity-60" : ""}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {m.label}
                        </Badge>
                        <Link href={`/shows/${m.showId}`} className={`font-medium hover:text-dts-maroon ${m.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {m.showName}
                        </Link>
                        {m.owner ? <span className="text-xs text-slate-400">· {m.owner}</span> : null}
                        {m.done ? <span className="text-xs font-medium text-emerald-600">done</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
