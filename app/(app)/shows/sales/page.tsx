import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { DateRangeFields } from "@/components/date-range-fields";
import { formatShortDate, formatDateRange } from "@/lib/format";
import { startCallDate, emailTeamDate, weekBeforeDate } from "@/lib/sales";
import { SalesGrid, type SalesGridRow } from "./sales-grid";

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
      "id, show_name, edition_year, show_start_date, show_end_date, exhibitor_count, industry_vertical, show_management_company, advance_warehouse_open, advance_warehouse_cutoff, direct_to_show_start, direct_to_show_end, sales_people, lead_gen_owner, lead_gen_start_date, lead_gen_completion_date, move_in_schedule_url, emailed_two_weeks, instantly_created, archived",
    )
    .eq("archived", false);

  const today = new Date().toISOString().slice(0, 10);
  const hasRange = !!(from || to);

  const rows: SalesGridRow[] = (shows ?? [])
    .filter((s) => s.show_start_date)
    .filter((s) => !hasRange || ((!from || s.show_start_date! >= from) && (!to || s.show_start_date! <= to)))
    .sort((a, b) => (a.show_start_date ?? "").localeCompare(b.show_start_date ?? ""))
    .map((s) => ({
      id: s.id,
      showName: s.show_name,
      editionYear: s.edition_year,
      showDates: formatDateRange(s.show_start_date, s.show_end_date),
      startCall: formatShortDate(startCallDate(s.show_start_date)),
      emailTeam: formatShortDate(emailTeamDate(s.show_start_date)),
      weekBefore: formatShortDate(weekBeforeDate(s.show_start_date)),
      past: (s.show_end_date ?? s.show_start_date)! < today,
      exhibitor_count: s.exhibitor_count,
      industry_vertical: s.industry_vertical,
      show_management_company: s.show_management_company,
      advWhse: s.advance_warehouse_open || s.advance_warehouse_cutoff
        ? formatDateRange(s.advance_warehouse_open, s.advance_warehouse_cutoff)
        : "—",
      direct: s.direct_to_show_start || s.direct_to_show_end
        ? formatDateRange(s.direct_to_show_start, s.direct_to_show_end)
        : "—",
      sales_people: s.sales_people,
      lead_gen_owner: s.lead_gen_owner,
      lead_gen_start_date: s.lead_gen_start_date,
      lead_gen_completion_date: s.lead_gen_completion_date,
      emailed_two_weeks: !!s.emailed_two_weeks,
      instantly_created: !!s.instantly_created,
    }));

  return (
    <div>
      <PageHeader
        title="Sales calendar"
        description="Lead-gen and outreach per show — edit any field inline and Save. Start-call (−60d), email-team (−14d) and week-before (−7d) are computed from the show start."
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

      <Card className="p-4">
        {rows.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No shows to plan"
            description="Add show start dates on your shows to populate the sales calendar."
          />
        ) : (
          <SalesGrid rows={rows} />
        )}
      </Card>
    </div>
  );
}
