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

/**
 * Whether a customer is confirmed to exhibit at THIS show in 2026. confirmed_2026
 * is the customer's whole list of 2026-confirmed shows (duplicated across rows),
 * so we check whether this show appears in it, comparing on alphanumerics only
 * (the legacy history and the 2026 list use different naming styles).
 */
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function returningTo(showName: string, confirmed: string | null): boolean {
  if (!confirmed) return false;
  const key = alnum(showName);
  return key.length >= 3 && alnum(confirmed).includes(key);
}

// Sortable columns → view column + default direction.
const SORTS = {
  exhibitors: { col: "exhibitor_count", numeric: true },
  loads: { col: "total_loads", numeric: true },
  margin: { col: "total_margin", numeric: true },
  returning: { col: "confirmed_2026_count", numeric: true },
  years: { col: "last_year", numeric: true },
  name: { col: "show_name", numeric: false },
} as const;
type SortKey = keyof typeof SORTS;

export default async function ShowHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const { q = "", show = "", page: pageParam, sort: sortParam, dir: dirParam } = await searchParams;
  const supabase = await createClient();

  // ---- Detail: one show's historical exhibitors --------------------------
  if (show) {
    const [{ data: rows }, { data: rosterRows }] = await Promise.all([
      supabase
        .from("exhibitor_show_history")
        .select(
          "show_name, show_loads, first_year, last_year, margin, confirmed_2026, exhibitor:exhibitors(id, company_name, owner_rep, sales_status, priority_tier)",
        )
        .eq("canonical_show_name", show),
      supabase.from("exhibitor_show_roster").select("exhibitor_id").eq("show_name", show).eq("year", 2026),
    ]);
    const rosterSet = new Set((rosterRows ?? []).map((r) => r.exhibitor_id));
    const hasRoster = rosterSet.size > 0;

    // Merge a customer's variant rows (e.g. "FABTECH" + "FABTECH McCormick Place").
    type Agg = {
      id: string | null;
      company_name: string;
      owner_rep: string | null;
      sales_status: string | null;
      priority_tier: string | null;
      loads: number;
      margin: number;
      first: number | null;
      last: number | null;
      confirmed: string | null;
    };
    const byExhibitor = new Map<string, Agg>();
    for (const r of rows ?? []) {
      const e = r.exhibitor;
      const key = e?.id ?? `~${r.show_name}`;
      const cur =
        byExhibitor.get(key) ??
        {
          id: e?.id ?? null,
          company_name: e?.company_name ?? "—",
          owner_rep: e?.owner_rep ?? null,
          sales_status: e?.sales_status ?? null,
          priority_tier: e?.priority_tier ?? null,
          loads: 0,
          margin: 0,
          first: null,
          last: null,
          confirmed: r.confirmed_2026,
        };
      cur.loads += r.show_loads ?? 0;
      cur.margin += r.margin ?? 0;
      if (r.first_year != null) cur.first = cur.first == null ? r.first_year : Math.min(cur.first, r.first_year);
      if (r.last_year != null) cur.last = cur.last == null ? r.last_year : Math.max(cur.last, r.last_year);
      cur.confirmed = cur.confirmed ?? r.confirmed_2026;
      byExhibitor.set(key, cur);
    }
    const list = [...byExhibitor.values()].sort((a, b) => b.margin - a.margin);
    const totalLoads = list.reduce((s, r) => s + r.loads, 0);
    const totalMargin = list.reduce((s, r) => s + r.margin, 0);
    const returning = hasRoster
      ? list.filter((r) => r.id && rosterSet.has(r.id)).length
      : list.filter((r) => returningTo(show, r.confirmed)).length;

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
          description={`${list.length} exhibitor${list.length === 1 ? "" : "s"} shipped here · ${totalLoads} loads · ${formatCurrency(totalMargin)} margin · ${returning} ${hasRoster ? "on the 2026 roster" : "confirmed to return in 2026"}`}
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
                    <th className="px-5 py-3" title={hasRoster ? "On the saved 2026 roster for this show" : "Confirmed to exhibit at this show in 2026 (from scraped 2026 confirmations)"}>
                      Back in 2026?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {list.map((r, i) => {
                    const sm = salesStatusMeta(r.sales_status);
                    const tm = priorityTierMeta(r.priority_tier);
                    return (
                      <LinkRow key={i} href={r.id ? `/exhibitors/${r.id}` : "#"} className="group hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-900 group-hover:text-dts-maroon">
                          {r.company_name}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.owner_rep ?? <span className="text-slate-300">—</span>}
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
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">{r.loads || "—"}</td>
                        <td className="px-5 py-3 text-slate-500">{yearRange(r.first, r.last)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                          {r.margin ? formatCurrency(r.margin) : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs" title={r.confirmed ? `2026 confirmed: ${r.confirmed}` : undefined}>
                          {hasRoster ? (
                            r.id && rosterSet.has(r.id) ? (
                              <span className="font-medium text-emerald-600">✓ Roster</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )
                          ) : returningTo(show, r.confirmed) ? (
                            <span className="font-medium text-emerald-600">✓ Yes</span>
                          ) : r.confirmed ? (
                            <span className="text-slate-400">other shows</span>
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

  // ---- List: every show, sortable ----------------------------------------
  const sort: SortKey = (sortParam && sortParam in SORTS ? sortParam : "exhibitors") as SortKey;
  const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc";

  let query = supabase.from("show_history_summary").select("*");
  if (q.trim()) query = query.ilike("show_name", `%${q.trim()}%`);
  const { data: shows } = await query.order(SORTS[sort].col, {
    ascending: dir === "asc",
    nullsFirst: false,
  });
  const rows = shows ?? [];

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const baseParams = () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sort !== "exhibitors") p.set("sort", sort);
    if (dir !== "desc") p.set("dir", dir);
    return p;
  };
  const makeHref = (p: number) => {
    const params = baseParams();
    if (p > 1) params.set("page", String(p));
    return `/show-history${params.toString() ? `?${params}` : ""}`;
  };
  const sortHref = (col: SortKey) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const nextDir = sort === col ? (dir === "desc" ? "asc" : "desc") : SORTS[col].numeric ? "desc" : "asc";
    if (col !== "exhibitors") params.set("sort", col);
    else if (nextDir !== "desc") params.set("sort", col);
    if (nextDir !== "desc") params.set("dir", nextDir);
    return `/show-history${params.toString() ? `?${params}` : ""}`;
  };
  const arrow = (col: SortKey) => (sort === col ? (dir === "desc" ? " ↓" : " ↑") : "");

  const th = (col: SortKey, label: string, align: "left" | "right" = "left") => (
    <th key={col} className={`px-5 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <Link href={sortHref(col)} className="inline-flex items-center hover:text-slate-700">
        {label}
        <span className="text-dts-maroon">{arrow(col)}</span>
      </Link>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Show History"
        description="Which exhibitors historically shipped with each show — imported from the legacy trade-show master. Similar names are grouped (e.g. FABTECH variants)."
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search shows…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
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
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {th("name", "Show")}
                  {th("exhibitors", "Exhibitors", "right")}
                  {th("loads", "Loads", "right")}
                  {th("margin", "Margin", "right")}
                  {th("returning", "Returning 2026", "right")}
                  {th("years", "Years")}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paged.map((s) => (
                  <LinkRow
                    key={s.show_name}
                    href={`/show-history?show=${encodeURIComponent(s.show_name ?? "")}`}
                    className="group hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 group-hover:text-dts-maroon">{s.show_name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{s.exhibitor_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{s.total_loads}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{formatCurrency(s.total_margin ?? 0)}</td>
                    <td
                      className="px-5 py-3 text-right tabular-nums"
                      title={s.has_roster_2026 ? "From a saved 2026 roster" : "From scraped 2026 confirmations"}
                    >
                      {s.confirmed_2026_count ? (
                        <span className="text-emerald-600">
                          {s.confirmed_2026_count}
                          {s.has_roster_2026 ? <span className="ml-1 text-[10px] text-slate-400">roster</span> : null}
                        </span>
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
