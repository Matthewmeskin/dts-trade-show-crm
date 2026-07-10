import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { DateRangeFields } from "@/components/date-range-fields";
import { Pagination } from "@/components/pagination";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ExhibitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; industry?: string; from?: string; to?: string; page?: string }>;
}) {
  const { q = "", industry = "", from = "", to = "", page: pageParam } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("exhibitors").select("*").order("company_name");
  if (q.trim()) query = query.ilike("company_name", `%${q.trim()}%`);
  if (industry.trim()) query = query.eq("industry", industry);

  const [{ data: exhibitors }, { data: links }, ships, { data: allForFilter }] =
    await Promise.all([
      query,
      supabase.from("show_exhibitors").select("exhibitor_id, show_id"),
      // Count loads across the full shipments table — page past the 1,000-row cap.
      fetchAll<{ exhibitor_id: string | null; show_id: string | null; pickup_date: string | null }>(
        () => supabase.from("shipments").select("exhibitor_id, show_id, pickup_date"),
      ),
      supabase.from("exhibitors").select("industry"),
    ]);

  // When a date range is set, count only loads that pick up in the window, and
  // narrow the directory to exhibitors that have such loads.
  const hasRange = !!(from || to);
  const inRange = (p: string | null) => (!from || (!!p && p >= from)) && (!to || (!!p && p <= to));

  const showSets = new Map<string, Set<string>>();
  const loadCount = new Map<string, number>();
  const addShow = (eid: string | null, sid: string | null) => {
    if (!eid || !sid) return;
    const set = showSets.get(eid) ?? new Set<string>();
    set.add(sid);
    showSets.set(eid, set);
  };
  for (const s of ships ?? []) {
    if (hasRange && !inRange(s.pickup_date)) continue;
    addShow(s.exhibitor_id, s.show_id);
    if (s.exhibitor_id) loadCount.set(s.exhibitor_id, (loadCount.get(s.exhibitor_id) ?? 0) + 1);
  }
  // Manual show links carry no date, so only fold them in when not date-filtering.
  if (!hasRange) for (const l of links ?? []) addShow(l.exhibitor_id, l.show_id);

  const industries = [
    ...new Set((allForFilter ?? []).map((e) => e.industry).filter(Boolean)),
  ].sort() as string[];

  let rows = exhibitors ?? [];
  if (hasRange) rows = rows.filter((e) => (loadCount.get(e.id) ?? 0) > 0);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (industry) params.set("industry", industry);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (p > 1) params.set("page", String(p));
    return `/exhibitors${params.toString() ? `?${params}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Exhibitors"
        description="Directory of every exhibitor across your shows."
        actions={
          <Link
            href="/exhibitors/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New exhibitor
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <form className="flex items-center gap-2">
          <select
            name="industry"
            defaultValue={industry}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          >
            <option value="">All industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
          <DateRangeFields from={from} to={to} label="Pickup" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search companies…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Filter
          </button>
          {from || to ? (
            <Link
              href={`/exhibitors${(() => { const p = new URLSearchParams(); if (industry) p.set("industry", industry); if (q) p.set("q", q); return p.toString() ? `?${p}` : ""; })()}`}
              className="text-sm font-medium text-slate-400 hover:text-slate-700"
            >
              Clear dates
            </Link>
          ) : null}
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="exhibitors"
            title={q || industry || from || to ? "No exhibitors match" : "No exhibitors yet"}
            description={
              q || industry || from || to
                ? "Try a different search, filter, or date range."
                : "Add your first exhibitor to the directory."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Industry</th>
                  <th className="px-5 py-3">Primary contact</th>
                  <th className="px-5 py-3">Loads</th>
                  <th className="px-5 py-3">Shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedRows.map((e) => (
                  <LinkRow key={e.id} href={`/exhibitors/${e.id}`} className="group hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/exhibitors/${e.id}`}
                        className="font-medium text-slate-900 group-hover:text-dts-maroon"
                      >
                        {e.company_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {e.industry ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {e.primary_contact_name ? (
                        <>
                          {e.primary_contact_name}
                          {e.primary_contact_title ? (
                            <span className="text-slate-400"> · {e.primary_contact_title}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {loadCount.get(e.id) ?? 0}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {showSets.get(e.id)?.size ?? 0}
                    </td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              makeHref={makeHref}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
