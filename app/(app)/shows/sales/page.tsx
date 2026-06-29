import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { DateRangeFields } from "@/components/date-range-fields";
import { formatShortDate, formatDateRange } from "@/lib/format";
import { startCallDate, emailTeamDate, weekBeforeDate, shiftDays } from "@/lib/sales";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sales calendar · DTS Trade Show CRM" };

export default async function SalesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from = "", to = "" } = await searchParams;
  const supabase = await createClient();

  const { data: shows } = await supabase
    .from("shows")
    .select(
      "id, show_name, edition_year, show_start_date, show_end_date, sales_people, lead_gen_owner, lead_gen_start_date, lead_gen_completion_date, emailed_two_weeks, instantly_created, archived",
    )
    .eq("archived", false);

  const today = new Date().toISOString().slice(0, 10);
  const soon = shiftDays(today, 7)!; // next 7 days = "coming up"
  const hasRange = !!(from || to);

  const rows = (shows ?? [])
    .filter((s) => s.show_start_date)
    .filter((s) => !hasRange || ((!from || s.show_start_date! >= from) && (!to || s.show_start_date! <= to)))
    .sort((a, b) => (a.show_start_date ?? "").localeCompare(b.show_start_date ?? ""));

  // Colour a milestone date by urgency: today (maroon), within a week (amber),
  // past (muted), future (normal).
  const dcls = (date: string | null) => {
    if (!date) return "text-slate-300";
    if (date === today) return "font-semibold text-dts-maroon";
    if (date < today) return "text-slate-400";
    if (date <= soon) return "font-medium text-amber-600";
    return "text-slate-700";
  };

  return (
    <div>
      <PageHeader
        title="Sales calendar"
        description="Lead-gen and outreach timeline per show. Start-call (−60d), email-team (−14d) and week-before (−7d) are computed from the show start."
      />

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href="/shows" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
          Shows
        </Link>
        <span className="rounded-lg bg-dts-maroon px-3 py-1.5 text-sm font-medium text-white">Sales calendar</span>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <DateRangeFields from={from} to={to} label="Show date" />
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
        {from || to ? (
          <Link href="/shows/sales" className="text-sm font-medium text-slate-400 hover:text-slate-700">
            Clear
          </Link>
        ) : null}
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No shows to plan"
            description="Add show start dates and lead-gen details on your shows to populate the sales calendar."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Show</th>
                  <th className="px-4 py-3">Show dates</th>
                  <th className="px-4 py-3">Start call <span className="font-normal normal-case text-slate-300">−60d</span></th>
                  <th className="px-4 py-3">Email team <span className="font-normal normal-case text-slate-300">−14d</span></th>
                  <th className="px-4 py-3">Week before <span className="font-normal normal-case text-slate-300">−7d</span></th>
                  <th className="px-4 py-3">Lead gen</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((s) => {
                  const past = (s.show_end_date ?? s.show_start_date)! < today;
                  const sc = startCallDate(s.show_start_date);
                  const et = emailTeamDate(s.show_start_date);
                  const wb = weekBeforeDate(s.show_start_date);
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50/60 ${past ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/shows/${s.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                          {s.show_name}
                          {s.edition_year ? <span className="ml-1 text-slate-400">{s.edition_year}</span> : null}
                        </Link>
                        {s.sales_people ? <div className="text-xs text-slate-400">{s.sales_people}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDateRange(s.show_start_date, s.show_end_date)}</td>
                      <td className={`px-4 py-3 tabular-nums ${dcls(sc)}`}>{formatShortDate(sc)}</td>
                      <td className={`px-4 py-3 tabular-nums ${dcls(et)}`}>
                        {formatShortDate(et)}
                        {s.emailed_two_weeks ? <span className="ml-1 text-emerald-600">✓</span> : null}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${dcls(wb)}`}>{formatShortDate(wb)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.lead_gen_owner ?? <span className="text-slate-300">—</span>}
                        {s.lead_gen_start_date || s.lead_gen_completion_date ? (
                          <div className="text-xs text-slate-400">
                            {formatShortDate(s.lead_gen_start_date)} → {s.lead_gen_completion_date ? formatShortDate(s.lead_gen_completion_date) : "…"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.emailed_two_weeks ? <Badge className="bg-emerald-50 text-emerald-700">Emailed</Badge> : null}
                          {s.instantly_created ? <Badge className="bg-dts-blue/10 text-dts-blue">Instantly</Badge> : null}
                          {!s.emailed_two_weeks && !s.instantly_created ? <span className="text-xs text-slate-300">—</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
