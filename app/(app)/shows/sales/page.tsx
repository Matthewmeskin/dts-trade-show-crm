import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { DateRangeFields } from "@/components/date-range-fields";
import { formatShortDate, formatDateRange, todayYMD } from "@/lib/format";
import { startCallDate, emailTeamDate, weekBeforeDate, nextAction, parseReps } from "@/lib/sales";
import { SalesGrid, type SalesGridRow } from "./sales-grid";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sales calendar · DTS Trade Show CRM" };

/** "May 13 – Jun 5, 2026" -> "May 13 – Jun 5" (year is redundant in the grid). */
const stripYear = (s: string) => s.replace(/,\s*\d{4}$/, "");

export default async function SalesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; past?: string; owner?: string; rep?: string; sort?: string }>;
}) {
  const { from = "", to = "", past = "", owner = "", rep = "", sort = "" } = await searchParams;
  const supabase = await createClient();

  const { data: shows } = await supabase
    .from("shows")
    .select(
      "id, show_name, edition_year, show_start_date, show_end_date, exhibitor_count, industry_vertical, show_management_company, advance_warehouse_open, advance_warehouse_cutoff, direct_to_show_start, direct_to_show_end, sales_people, lead_gen_owner, lead_gen_start_date, lead_gen_completion_date, move_in_schedule_url, emailed_two_weeks, week_before_sent, instantly_created, archived",
    )
    .eq("archived", false);

  // Exhibitors linked to each show in the CRM: a second opinion next to the
  // typed count, and the only number most rows have.
  const { data: rosterRows } = await supabase.from("show_exhibitors").select("show_id");
  const roster = new Map<string, number>();
  for (const r of rosterRows ?? []) roster.set(r.show_id, (roster.get(r.show_id) ?? 0) + 1);

  const today = todayYMD();
  const hasRange = !!(from || to);
  const showPast = past === "1";
  const bySalesDate = sort === "show";

  const dated = (shows ?? []).filter((s) => s.show_start_date);
  const owners = [...new Set(dated.map((s) => s.lead_gen_owner?.trim()).filter((x): x is string => !!x))].sort();
  const reps = [...new Set(dated.flatMap((s) => parseReps(s.sales_people)))].sort((a, b) => a.localeCompare(b));

  // Past shows are clutter on a worklist: 29 of 51 rows the day this was
  // written. They stay one click away rather than in the way.
  const upcoming = dated.filter((s) => (s.show_end_date ?? s.show_start_date)! >= today);
  const pool = showPast || hasRange ? dated : upcoming;

  const listed = pool
    .filter((s) => !hasRange || ((!from || s.show_start_date! >= from) && (!to || s.show_start_date! <= to)))
    .filter((s) => !owner || (s.lead_gen_owner ?? "").trim() === owner)
    .filter((s) => !rep || parseReps(s.sales_people).some((n) => n.toLowerCase() === rep.toLowerCase()))
    .map((s) => ({ s, next: nextAction(s, today) }));

  // Default order is "what needs doing first": overdue, then due this week,
  // then by the action date; shows that have opened sink to the bottom.
  const rank: Record<string, number> = { overdue: 0, due_soon: 1, later: 2, none: 3, done: 4 };
  listed.sort((a, b) => {
    if (bySalesDate) return (a.s.show_start_date ?? "").localeCompare(b.s.show_start_date ?? "");
    const ra = rank[a.next?.state ?? "none"];
    const rb = rank[b.next?.state ?? "none"];
    if (ra !== rb) return ra - rb;
    const da = a.next?.date ?? a.s.show_start_date ?? "";
    const db = b.next?.date ?? b.s.show_start_date ?? "";
    return da.localeCompare(db) || (a.s.show_start_date ?? "").localeCompare(b.s.show_start_date ?? "");
  });

  const stats = {
    upcoming: upcoming.length,
    overdue: upcoming.map((s) => nextAction(s, today)).filter((n) => n?.state === "overdue").length,
    dueSoon: upcoming.map((s) => nextAction(s, today)).filter((n) => n?.state === "due_soon").length,
    noRep: upcoming.filter((s) => parseReps(s.sales_people).length === 0).length,
  };

  const rows: SalesGridRow[] = listed
    .map(({ s, next }) => ({
      id: s.id,
      showName: s.show_name,
      editionYear: s.edition_year,
      showDates: formatDateRange(s.show_start_date, s.show_end_date),
      next: next
        ? { kind: next.kind, label: next.label, date: formatShortDate(next.date), state: next.state, daysOut: next.daysOut }
        : null,
      rosterCount: roster.get(s.id) ?? 0,
      startCall: formatShortDate(startCallDate(s.show_start_date)),
      emailTeam: formatShortDate(emailTeamDate(s.show_start_date)),
      weekBefore: formatShortDate(weekBeforeDate(s.show_start_date)),
      past: (s.show_end_date ?? s.show_start_date)! < today,
      exhibitor_count: s.exhibitor_count,
      industry_vertical: s.industry_vertical,
      show_management_company: s.show_management_company,
      // Drop the year on the freight windows so they fit on one line in the grid.
      advWhse: s.advance_warehouse_open || s.advance_warehouse_cutoff
        ? stripYear(formatDateRange(s.advance_warehouse_open, s.advance_warehouse_cutoff))
        : "—",
      direct: s.direct_to_show_start || s.direct_to_show_end
        ? stripYear(formatDateRange(s.direct_to_show_start, s.direct_to_show_end))
        : "—",
      sales_people: s.sales_people,
      lead_gen_owner: s.lead_gen_owner,
      lead_gen_start_date: s.lead_gen_start_date,
      lead_gen_completion_date: s.lead_gen_completion_date,
      emailed_two_weeks: !!s.emailed_two_weeks,
      week_before_sent: !!s.week_before_sent,
      instantly_created: !!s.instantly_created,
    }));

  return (
    <div>
      <PageHeader
        title="Sales calendar"
        description="Lead-gen and outreach per show, ordered by what needs doing first. Edit any field inline; it saves when you leave the row. Start-call (−60d), email-team (−14d) and week-before (−7d) count back from the show start."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Upcoming shows", value: stats.upcoming, tone: "text-slate-900" },
          { label: "Overdue actions", value: stats.overdue, tone: stats.overdue ? "text-rose-700" : "text-slate-900" },
          { label: "Due this week", value: stats.dueSoon, tone: stats.dueSoon ? "text-amber-700" : "text-slate-900" },
          { label: "No sales rep yet", value: stats.noRep, tone: stats.noRep ? "text-amber-700" : "text-slate-900" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</div>
            <div className={`mt-0.5 text-2xl font-semibold ${t.tone}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href="/shows" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
          Shows
        </Link>
        <span className="rounded-lg bg-dts-maroon px-3 py-1.5 text-sm font-medium text-white">Sales calendar</span>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <DateRangeFields from={from} to={to} label="Show date" />
        {showPast ? <input type="hidden" name="past" value="1" /> : null}
        {owner ? <input type="hidden" name="owner" value={owner} /> : null}
        {rep ? <input type="hidden" name="rep" value={rep} /> : null}
        {bySalesDate ? <input type="hidden" name="sort" value="show" /> : null}
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
        {from || to ? (
          <Link href={qs({ past, owner, rep, sort })} className="text-sm font-medium text-slate-400 hover:text-slate-700">
            Clear
          </Link>
        ) : null}

      </form>

      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        <span className="text-slate-400">Lead gen</span>
        <Chip href={qs({ from, to, past, rep, sort })} active={!owner}>All</Chip>
        {owners.map((o) => (
          <Chip key={o} href={qs({ from, to, past, rep, sort, owner: o })} active={owner === o}>
            {o}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <span className="text-slate-400">Sales rep</span>
        <Chip href={qs({ from, to, past, owner, sort })} active={!rep}>All</Chip>
        {reps.map((o) => (
          <Chip key={o} href={qs({ from, to, past, owner, sort, rep: o })} active={rep.toLowerCase() === o.toLowerCase()}>
            {o}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Chip href={qs({ from, to, owner, rep, sort, past: showPast ? "" : "1" })} active={showPast}>
          {showPast ? "Hiding past shows" : "Show past shows"}
        </Chip>
        <Chip href={qs({ from, to, owner, rep, past, sort: bySalesDate ? "" : "show" })} active={bySalesDate}>
          {bySalesDate ? "Sorted by show date" : "Sort by show date"}
        </Chip>
      </div>

      <p className="mb-3 text-xs text-slate-400">
        <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" /> overdue</span>
        <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> due within 7 days</span>
        <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" /> later</span>
        <span>✓ Done marks the step with the same fields you would edit by hand — calling sets LG start to today, the two emails tick their boxes.</span>
      </p>

      <Card className="p-4">
        {rows.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No shows to plan"
            description="Add show start dates on your shows to populate the sales calendar."
          />
        ) : (
          <SalesGrid rows={rows} grouped={!bySalesDate} repOptions={reps} ownerOptions={owners} />
        )}
      </Card>
    </div>
  );
}

/** /shows/sales with only the non-empty params, so links stay short. */
function qs(params: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const q = p.toString();
  return q ? `/shows/sales?${q}` : "/shows/sales";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-dts-maroon bg-dts-maroon/10 text-dts-maroon"
          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
      }`}
    >
      {children}
    </Link>
  );
}
