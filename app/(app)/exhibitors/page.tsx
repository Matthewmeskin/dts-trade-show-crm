import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { DateRangeFields } from "@/components/date-range-fields";
import { Pagination } from "@/components/pagination";
import {
  SALES_STATUS_OPTIONS,
  PRIORITY_TIER_OPTIONS,
  salesStatusMeta,
  priorityTierMeta,
} from "@/lib/exhibitors";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ExhibitorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    status?: string;
    tier?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { q = "", industry = "", status = "", tier = "", from = "", to = "", page: pageParam } =
    await searchParams;
  const supabase = await createClient();

  let query = supabase.from("exhibitors").select("*").order("company_name");
  if (q.trim()) query = query.ilike("company_name", `%${q.trim()}%`);
  if (industry.trim()) query = query.eq("industry", industry);
  if (status.trim()) query = query.eq("sales_status", status);
  if (tier.trim()) query = query.eq("priority_tier", tier);

  // When a date range is set, count only loads that pick up in the window, and
  // narrow the directory to exhibitors that have such loads.
  const hasRange = !!(from || to);

  const [{ data: exhibitors }, { data: links }, { data: stats }, { data: allForFilter }] =
    await Promise.all([
      query,
      supabase.from("show_exhibitors").select("exhibitor_id, show_id"),
      // Loads + distinct shows per exhibitor, counted in the database.
      supabase.rpc("exhibitor_shipment_stats", { p_from: from || undefined, p_to: to || undefined }),
      supabase.from("exhibitors").select("industry"),
    ]);

  const showSets = new Map<string, Set<string>>();
  const loadCount = new Map<string, number>();
  for (const r of stats ?? []) {
    if (!r.exhibitor_id) continue;
    loadCount.set(r.exhibitor_id, Number(r.load_count));
    showSets.set(r.exhibitor_id, new Set((r.show_ids ?? []) as string[]));
  }
  // Manual show links carry no date, so only fold them in when not date-filtering.
  if (!hasRange)
    for (const l of links ?? []) {
      if (!l.exhibitor_id || !l.show_id) continue;
      const set = showSets.get(l.exhibitor_id) ?? new Set<string>();
      set.add(l.show_id);
      showSets.set(l.exhibitor_id, set);
    }

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
    if (status) params.set("status", status);
    if (tier) params.set("tier", tier);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (p > 1) params.set("page", String(p));
    return `/exhibitors${params.toString() ? `?${params}` : ""}`;
  };
  const anyFilter = !!(q || industry || status || tier || from || to);

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
            name="status"
            defaultValue={status}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          >
            <option value="">All statuses</option>
            {SALES_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {salesStatusMeta(o.value)?.label ?? o.value}
              </option>
            ))}
          </select>
          <select
            name="tier"
            defaultValue={tier}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          >
            <option value="">All tiers</option>
            {PRIORITY_TIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Tier {o.value}
              </option>
            ))}
          </select>
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
              href={`/exhibitors${(() => { const p = new URLSearchParams(); if (industry) p.set("industry", industry); if (status) p.set("status", status); if (tier) p.set("tier", tier); if (q) p.set("q", q); return p.toString() ? `?${p}` : ""; })()}`}
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
            title={anyFilter ? "No exhibitors match" : "No exhibitors yet"}
            description={
              anyFilter
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
                  <th className="px-5 py-3">Owner / rep</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3 text-right">Loads</th>
                  <th className="px-5 py-3 text-right">Shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedRows.map((e) => {
                  const sm = salesStatusMeta(e.sales_status);
                  const tm = priorityTierMeta(e.priority_tier);
                  const liveLoads = loadCount.get(e.id) ?? 0;
                  return (
                    <LinkRow key={e.id} href={`/exhibitors/${e.id}`} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link
                          href={`/exhibitors/${e.id}`}
                          className="font-medium text-slate-900 group-hover:text-dts-maroon"
                        >
                          {e.company_name}
                        </Link>
                        {e.industry ? (
                          <div className="text-xs text-slate-400">{e.industry}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {e.owner_rep ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {sm ? (
                          <Badge className={sm.badge}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                            {sm.label}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {tm ? (
                          <Badge className={tm.badge}>{tm.label}</Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                        {liveLoads > 0 ? (
                          liveLoads
                        ) : e.legacy_loads ? (
                          <span className="text-slate-400" title="Legacy loads (pre-TMS)">
                            {e.legacy_loads}
                            <span className="ml-1 text-[10px] uppercase tracking-wide">leg</span>
                          </span>
                        ) : (
                          0
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                        {showSets.get(e.id)?.size ?? 0}
                      </td>
                    </LinkRow>
                  );
                })}
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
