import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { formatCurrency } from "@/lib/format";
import { salesStatusMeta, priorityTierMeta } from "@/lib/exhibitors";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function yearRange(a: number | null, b: number | null) {
  if (!a && !b) return "—";
  if (a && b) return a === b ? String(a) : `${a}–${b}`;
  return String(a ?? b);
}

export default async function ShowHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string; page?: string }>;
}) {
  const { q = "", show = "", page: pageParam } = await searchParams;
  const supabase = await createClient();

  // ---- Detail: one show's historical exhibitors --------------------------
  if (show) {
    const { data: rows } = await supabase
      .from("exhibitor_show_history")
      .select(
        "show_loads, first_year, last_year, margin, confirmed_2026, exhibitor:exhibitors(id, company_name, owner_rep, sales_status, priority_tier)",
      )
      .eq("show_name", show)
      .order("margin", { ascending: false, nullsFirst: false });

    const list = rows ?? [];
    const totalLoads = list.reduce((s, r) => s + (r.show_loads ?? 0), 0);
    const totalMargin = list.reduce((s, r) => s + (r.margin ?? 0), 0);
    const confirmed = list.filter((r) => r.confirmed_2026).length;

    return (
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
          <Link href="/show-history" className="hover:text-slate-700">
            Show History
          </Link>
          <span>/</span>
          <span className="text-slate-600">{show}</span>
        </div>
        <PageHeader
          title={show}
          description={`${list.length} exhibitor${list.length === 1 ? "" : "s"} shipped here · ${totalLoads} loads · ${formatCurrency(totalMargin)} margin · ${confirmed} confirmed for 2026`}
        />

        <Card>
          {list.length === 0 ? (
            <EmptyState icon="shows" title="No history" description="No exhibitors recorded for this show." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Exhibitor</th>
                    <th className="px-5 py-3">Owner / rep</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Tier</th>
                    <th className="px-5 py-3 text-right">Loads</th>
                    <th className="px-5 py-3">Years</th>
                    <th className="px-5 py-3 text-right">Margin</th>
                    <th className="px-5 py-3">2026?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {list.map((r, i) => {
                    const e = r.exhibitor;
                    const sm = salesStatusMeta(e?.sales_status);
                    const tm = priorityTierMeta(e?.priority_tier);
                    return (
                      <LinkRow
                        key={i}
                        href={e ? `/exhibitors/${e.id}` : "#"}
                        className="group hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3 font-medium text-slate-900 group-hover:text-dts-maroon">
                          {e?.company_name ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {e?.owner_rep ?? <span className="text-slate-300">—</span>}
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
                          {tm ? <Badge className={tm.badge}>{tm.label}</Badge> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                          {r.show_loads ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{yearRange(r.first_year, r.last_year)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                          {r.margin != null ? formatCurrency(r.margin) : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {r.confirmed_2026 ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </LinkRow>
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

  // ---- List: every legacy show, most-attended first ----------------------
  let query = supabase
    .from("show_history_summary")
    .select("*")
    .order("exhibitor_count", { ascending: false });
  if (q.trim()) query = query.ilike("show_name", `%${q.trim()}%`);

  const { data: shows } = await query;
  const rows = shows ?? [];

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    return `/show-history${params.toString() ? `?${params}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Show History"
        description="Which exhibitors historically shipped with each show — imported from the legacy trade-show master."
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search shows…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Search
          </button>
          {q ? (
            <Link href="/show-history" className="text-sm font-medium text-slate-400 hover:text-slate-700">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="clock"
            title={q ? "No shows match" : "No show history"}
            description={q ? "Try a different search." : "Import the legacy customer master to populate show history."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Show</th>
                  <th className="px-5 py-3 text-right">Exhibitors</th>
                  <th className="px-5 py-3 text-right">Loads</th>
                  <th className="px-5 py-3 text-right">Margin</th>
                  <th className="px-5 py-3 text-right">2026 confirmed</th>
                  <th className="px-5 py-3">Years</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paged.map((s) => (
                  <LinkRow
                    key={s.show_name}
                    href={`/show-history?show=${encodeURIComponent(s.show_name ?? "")}`}
                    className="group hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 group-hover:text-dts-maroon">
                      {s.show_name}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{s.exhibitor_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{s.total_loads}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(s.total_margin ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {s.confirmed_2026_count ? (
                        <span className="text-emerald-600">{s.confirmed_2026_count}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{yearRange(s.first_year, s.last_year)}</td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} makeHref={makeHref} />
          </div>
        )}
      </Card>
    </div>
  );
}
