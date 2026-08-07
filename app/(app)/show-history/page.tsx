import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { formatCurrency } from "@/lib/format";
import { salesStatusMeta, priorityTierMeta } from "@/lib/exhibitors";
import { createShowFromHistory } from "./actions";

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
  searchParams: Promise<{ q?: string; show?: string; page?: string; sort?: string; dir?: string; seg?: string }>;
}) {
  const { q = "", show = "", page: pageParam, sort: sortParam, dir: dirParam, seg: segParam } = await searchParams;
  const supabase = await createClient();

  // ---- Detail: one show's historical exhibitors --------------------------
  if (show) {
    const [{ data: rows }, { data: rosterRows }, existingShowRes] = await Promise.all([
      supabase
        .from("exhibitor_show_history")
        .select(
          "show_name, show_loads, first_year, last_year, margin, confirmed_2026, exhibitor:exhibitors(id, company_name, owner_rep, sales_status, priority_tier, source)",
        )
        .eq("canonical_show_name", show),
      supabase
        .from("exhibitor_show_roster")
        .select("exhibitor_id, exhibitor:exhibitors(id, company_name, owner_rep, sales_status, priority_tier, source)")
        .eq("show_name", show)
        .eq("year", 2026),
      supabase.from("shows").select("id, show_name, edition_year"),
    ]);
    // Real show records whose (descriptive) name matches this canonical name —
    // e.g. "IMTS ( International Manufacturing Technology Show)" for "IMTS".
    // Compare on alphanumerics: a real name that contains the canonical key.
    const showKey = alnum(show);
    const matchedShows =
      showKey.length >= 4
        ? (existingShowRes.data ?? []).filter((s) => alnum(s.show_name ?? "").includes(showKey))
        : [];
    const matchedShowIds = matchedShows.map((s) => s.id);
    const existingShowId = matchedShows.find((s) => s.edition_year === 2026)?.id ?? null;

    // Live TMS shipments for those real shows (all editions) — folds real loads
    // into the legacy per-show picture so actual shippers aren't shown blank.
    const tmsRows =
      matchedShowIds.length > 0
        ? await fetchAll<{
            exhibitor_id: string | null;
            pickup_date: string | null;
            margin: number | null;
            exhibitor: {
              id: string;
              company_name: string;
              owner_rep: string | null;
              sales_status: string | null;
              priority_tier: string | null;
              source: string;
            } | null;
          }>(() =>
            supabase
              .from("shipments")
              .select(
                "exhibitor_id, pickup_date, margin, exhibitor:exhibitors(id, company_name, owner_rep, sales_status, priority_tier, source)",
              )
              .in("show_id", matchedShowIds),
          )
        : [];
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
      source: string | null;
      rosterOnly?: boolean;
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
          source: e?.source ?? null,
        };
      cur.loads += r.show_loads ?? 0;
      cur.margin += r.margin ?? 0;
      if (r.first_year != null) cur.first = cur.first == null ? r.first_year : Math.min(cur.first, r.first_year);
      if (r.last_year != null) cur.last = cur.last == null ? r.last_year : Math.max(cur.last, r.last_year);
      cur.confirmed = cur.confirmed ?? r.confirmed_2026;
      byExhibitor.set(key, cur);
    }
    // Fold in live TMS shipments (each shipment = one load).
    for (const s of tmsRows) {
      const e = s.exhibitor;
      if (!e?.id) continue;
      const cur =
        byExhibitor.get(e.id) ??
        {
          id: e.id,
          company_name: e.company_name,
          owner_rep: e.owner_rep,
          sales_status: e.sales_status,
          priority_tier: e.priority_tier,
          loads: 0,
          margin: 0,
          first: null,
          last: null,
          confirmed: null,
          source: e.source,
        };
      cur.loads += 1;
      cur.margin += s.margin ?? 0;
      const yr = s.pickup_date ? Number(s.pickup_date.slice(0, 4)) : null;
      if (yr) {
        cur.first = cur.first == null ? yr : Math.min(cur.first, yr);
        cur.last = cur.last == null ? yr : Math.max(cur.last, yr);
      }
      byExhibitor.set(e.id, cur);
    }
    // Exhibitors who shipped this show (legacy history + live TMS).
    const shippedCount = byExhibitor.size;
    // Add 2026-roster members with no shipping history (e.g. freight customers
    // just promoted to exhibitors) so they appear on the show, tagged as new.
    for (const rr of rosterRows ?? []) {
      const e = rr.exhibitor;
      if (!e || byExhibitor.has(e.id)) continue;
      byExhibitor.set(e.id, {
        id: e.id,
        company_name: e.company_name,
        owner_rep: e.owner_rep,
        sales_status: e.sales_status,
        priority_tier: e.priority_tier,
        loads: 0,
        margin: 0,
        first: null,
        last: null,
        confirmed: null,
        source: e.source ?? null,
        rosterOnly: true,
      });
    }
    const isReturning = (r: Agg) => (hasRoster ? !!(r.id && rosterSet.has(r.id)) : returningTo(show, r.confirmed));
    const dSorts: Record<string, boolean> = {
      name: true, owner: true, status: true, tier: true, // string sorts (asc default)
      loads: false, years: false, margin: false, back: false, // numeric (desc default)
    };
    const dsort = sortParam && sortParam in dSorts ? sortParam : "margin";
    const ddir: "asc" | "desc" =
      dirParam === "asc" ? "asc" : dirParam === "desc" ? "desc" : dSorts[dsort] ? "asc" : "desc";
    const dval = (r: Agg): string | number => {
      switch (dsort) {
        case "name": return r.company_name.toLowerCase();
        case "owner": return (r.owner_rep ?? "").toLowerCase();
        case "status": return r.sales_status ?? "";
        case "tier": return r.priority_tier ?? "";
        case "loads": return r.loads;
        case "years": return r.last ?? 0;
        case "back": return isReturning(r) ? 1 : 0;
        default: return r.margin;
      }
    };
    const list = [...byExhibitor.values()].sort((a, b) => {
      const av = dval(a);
      const bv = dval(b);
      if (av < bv) return ddir === "asc" ? -1 : 1;
      if (av > bv) return ddir === "asc" ? 1 : -1;
      return 0;
    });
    const totalLoads = list.reduce((s, r) => s + r.loads, 0);
    const totalMargin = list.reduce((s, r) => s + r.margin, 0);
    const returning = list.filter(isReturning).length;

    // Segment filter.
    const segPred: Record<string, (r: Agg) => boolean> = {
      all: () => true,
      roster: (r) => isReturning(r),
      new: (r) => !!r.rosterOnly,
      freight: (r) => r.source === "promoted_from_customer",
      shipped: (r) => !r.rosterOnly,
    };
    const SEGMENTS: { key: string; label: string }[] = [
      { key: "all", label: "All" },
      { key: "roster", label: "On 2026 roster" },
      { key: "new", label: "No loads here" },
      { key: "freight", label: "Freight" },
      { key: "shipped", label: "Shipped before" },
    ];
    const seg = segParam && segParam in segPred ? segParam : "all";
    const filtered = list.filter(segPred[seg]);

    const dSortHref = (key: string) => {
      const params = new URLSearchParams();
      params.set("show", show);
      if (q) params.set("q", q);
      if (seg !== "all") params.set("seg", seg);
      const nextDir = dsort === key ? (ddir === "asc" ? "desc" : "asc") : dSorts[key] ? "asc" : "desc";
      params.set("sort", key);
      params.set("dir", nextDir);
      return `/show-history?${params}`;
    };
    const segHref = (key: string) => {
      const params = new URLSearchParams();
      params.set("show", show);
      if (q) params.set("q", q);
      if (dsort !== "margin") params.set("sort", dsort);
      if (ddir !== "desc") params.set("dir", ddir);
      if (key !== "all") params.set("seg", key);
      return `/show-history?${params}`;
    };
    const dArrow = (key: string) => (dsort === key ? (ddir === "asc" ? " ↑" : " ↓") : "");
    const dth = (key: string, label: string, align: "left" | "right" = "left") => (
      <th key={key} className={`px-5 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
        <Link href={dSortHref(key)} className="inline-flex items-center hover:text-slate-700">
          {label}
          <span className="text-dts-maroon">{dArrow(key)}</span>
        </Link>
      </th>
    );

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
          description={`${shippedCount} exhibitor${shippedCount === 1 ? "" : "s"} shipped here · ${totalLoads} loads · ${formatCurrency(totalMargin)} margin · ${returning} ${hasRoster ? "on the 2026 roster" : "confirmed to return in 2026"}`}
          actions={
            existingShowId ? (
              <Link
                href={`/shows/${existingShowId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dts-maroon px-3.5 py-2 text-sm font-medium text-dts-maroon transition hover:bg-dts-maroon hover:text-white"
              >
                Open 2026 show
              </Link>
            ) : (
              <form action={createShowFromHistory}>
                <input type="hidden" name="show" value={show} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
                  title="Create a 2026 show record and attach these exhibitors"
                >
                  Create 2026 show
                </button>
              </form>
            )
          }
        />

        <Card>
          {list.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-5 py-3 text-sm">
              {SEGMENTS.map((s) => {
                const count = list.filter(segPred[s.key]).length;
                if (s.key !== "all" && count === 0) return null;
                return (
                  <Link
                    key={s.key}
                    href={segHref(s.key)}
                    className={`rounded-lg px-2.5 py-1 font-medium transition ${
                      seg === s.key ? "bg-dts-maroon text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {s.label}{" "}
                    <span className={seg === s.key ? "text-white/70" : "text-slate-400"}>{count}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {list.length === 0 ? (
            <EmptyState icon="shows" title="No history" description="No exhibitors recorded for this show." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {dth("name", "Exhibitor")}
                    {dth("owner", "Owner / rep")}
                    {dth("status", "Status")}
                    {dth("tier", "Tier")}
                    {dth("loads", "Loads", "right")}
                    {dth("years", "Years")}
                    {dth("margin", "Margin", "right")}
                    {dth("back", "Back in 2026?")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((r, i) => {
                    const sm = salesStatusMeta(r.sales_status);
                    const tm = priorityTierMeta(r.priority_tier);
                    return (
                      <LinkRow key={i} href={r.id ? `/exhibitors/${r.id}` : "#"} className="group hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-900 group-hover:text-dts-maroon">
                          {r.company_name}
                          {r.rosterOnly ? (
                            r.source === "promoted_from_customer" ? (
                              <span
                                className="ml-1.5 rounded bg-dts-blue/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-dts-blue"
                                title="Freight customer promoted to exhibitor — new to trade-show freight with you"
                              >
                                freight customer
                              </span>
                            ) : (
                              <span
                                className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
                                title="On the 2026 roster; no loads for THIS show on record. They may ship other shows with you (or the legacy show-level detail is missing) — check their exhibitor page."
                              >
                                no loads here
                              </span>
                            )
                          ) : null}
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
