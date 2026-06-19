import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getReport } from "@/lib/reports";
import { Constants } from "@/lib/database.types";
import { SHOW_STATUS_META } from "@/lib/shows";
import {
  SHIPMENT_STATUS_META,
  ROLLUP_META,
  rollupShipmentStatus,
  type ShipmentStatus,
} from "@/lib/shipments";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format";
import { ShowSelect } from "../show-select";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { report } = await params;
  const def = getReport(report);
  if (!def) notFound();

  const { show } = await searchParams;
  const supabase = await createClient();

  let showOptions: { id: string; label: string }[] = [];
  if (def.scoped) {
    const { data } = await supabase
      .from("shows")
      .select("id, show_name, edition_year")
      .order("show_name");
    showOptions = (data ?? []).map((s) => ({
      id: s.id,
      label: `${s.show_name}${s.edition_year ? ` ${s.edition_year}` : ""}`,
    }));
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/reports" className="hover:text-slate-700">Reports</Link>
        <span>/</span>
        <span className="text-slate-600">{def.title}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
            {def.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{def.description}</p>
        </div>
        {def.scoped ? (
          <ShowSelect shows={showOptions} value={show ?? ""} basePath={`/reports/${def.slug}`} />
        ) : null}
      </div>

      {def.scoped && !show ? (
        <Card>
          <EmptyState icon={def.icon} title="Select a show" description="Choose a show above to run this report." />
        </Card>
      ) : (
        <>
          {def.slug === "exhibitors-per-show" && <ExhibitorsPerShow showId={show!} />}
          {def.slug === "shipments-by-status" && <ShipmentsByStatus showId={show!} />}
          {def.slug === "show-summary" && <ShowSummary showId={show!} />}
          {def.slug === "exhibitor-history" && <ExhibitorHistory />}
          {def.slug === "carrier-usage" && <CarrierUsage />}
          {def.slug === "revenue" && <Revenue />}
          {def.slug === "financials" && <Financials />}
        </>
      )}
    </div>
  );
}

/* ---- helpers ------------------------------------------------------------- */

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-5 py-3 text-slate-600 ${right ? "text-right" : ""}`}>{children}</td>;
}

const STATUS_ORDER = Constants.public.Enums.shipment_status;

/* ---- Revenue (global) ---------------------------------------------------- */

async function Revenue() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shows_with_status")
    .select("id, show_name, edition_year, status, estimated_revenue, actual_revenue")
    .order("show_name");
  const rows = data ?? [];

  const totEst = rows.reduce((a, r) => a + (r.estimated_revenue ?? 0), 0);
  const totAct = rows.reduce((a, r) => a + (r.actual_revenue ?? 0), 0);

  if (rows.length === 0) return <EmptyCard icon="reports" />;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Show</Th><Th>Status</Th><Th right>Estimated</Th><Th right>Actual</Th><Th right>Variance</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => {
              const meta = SHOW_STATUS_META[r.status ?? "upcoming"];
              const variance = r.estimated_revenue != null && r.actual_revenue != null ? r.actual_revenue - r.estimated_revenue : null;
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/shows/${r.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                      {r.show_name}{r.edition_year ? <span className="ml-1 text-slate-400">{r.edition_year}</span> : null}
                    </Link>
                  </td>
                  <td className="px-5 py-3"><Badge className={meta.badge}>{meta.label}</Badge></td>
                  <Td right>{formatCurrency(r.estimated_revenue)}</Td>
                  <Td right>{formatCurrency(r.actual_revenue)}</Td>
                  <td className="px-5 py-3 text-right font-medium">
                    {variance == null ? <span className="text-slate-300">—</span> : (
                      <span className={variance >= 0 ? "text-emerald-600" : "text-dts-maroon"}>
                        {variance >= 0 ? "+" : "−"}{formatCurrency(Math.abs(variance))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <td className="px-5 py-3" colSpan={2}>Total</td>
              <td className="px-5 py-3 text-right">{formatCurrency(totEst)}</td>
              <td className="px-5 py-3 text-right">{formatCurrency(totAct)}</td>
              <td className="px-5 py-3 text-right">
                <span className={totAct - totEst >= 0 ? "text-emerald-600" : "text-dts-maroon"}>
                  {totAct - totEst >= 0 ? "+" : "−"}{formatCurrency(Math.abs(totAct - totEst))}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* ---- Financials by show & carrier (global) ------------------------------ */

async function Financials() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shipments")
    .select(
      "show_id, carrier_id, billed_amount, cost_amount, show:shows(show_name, edition_year), carrier:carriers(carrier_name)",
    );
  const ships = data ?? [];

  type Car = { id: string | null; name: string; count: number; billed: number; cost: number };
  type Sh = {
    id: string | null;
    name: string;
    edition: number | null;
    count: number;
    billed: number;
    cost: number;
    carriers: Map<string, Car>;
  };

  const shows = new Map<string, Sh>();
  for (const s of ships) {
    // Only shipments that carry a billed or cost figure contribute.
    if (s.billed_amount == null && s.cost_amount == null) continue;
    const billed = s.billed_amount ?? 0;
    const cost = s.cost_amount ?? 0;

    const showKey = s.show_id ?? "__none__";
    let sh = shows.get(showKey);
    if (!sh) {
      sh = {
        id: s.show_id ?? null,
        name: s.show?.show_name ?? "Unassigned",
        edition: s.show?.edition_year ?? null,
        count: 0,
        billed: 0,
        cost: 0,
        carriers: new Map(),
      };
      shows.set(showKey, sh);
    }
    sh.count += 1;
    sh.billed += billed;
    sh.cost += cost;

    const carKey = s.carrier_id ?? "__none__";
    let car = sh.carriers.get(carKey);
    if (!car) {
      car = { id: s.carrier_id ?? null, name: s.carrier?.carrier_name ?? "No carrier", count: 0, billed: 0, cost: 0 };
      sh.carriers.set(carKey, car);
    }
    car.count += 1;
    car.billed += billed;
    car.cost += cost;
  }

  if (shows.size === 0)
    return <EmptyCard icon="reports" label="No billed or cost figures on any shipment yet." />;

  // Unassigned (no show) sorts last; everything else alphabetical.
  const byName = <T extends { id: string | null; name: string }>(a: T, b: T) =>
    a.id === null ? 1 : b.id === null ? -1 : a.name.localeCompare(b.name);
  const showList = [...shows.values()].sort(byName);
  const grand = showList.reduce(
    (acc, s) => ({ billed: acc.billed + s.billed, cost: acc.cost + s.cost }),
    { billed: 0, cost: 0 },
  );

  const money = (n: number) => formatCurrency(n, { cents: true });
  const marginClass = (n: number) => (n < 0 ? "text-dts-maroon" : "text-emerald-600");

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Show / Carrier</Th><Th right>Shipments</Th><Th right>Billed</Th><Th right>Cost</Th><Th right>Margin</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {showList.map((s) => {
              const carriers = [...s.carriers.values()].sort(byName);
              const showMargin = s.billed - s.cost;
              return (
                <Fragment key={s.id ?? "__none__"}>
                  <tr className="bg-slate-50/50">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {s.id ? (
                        <Link href={`/shows/${s.id}`} className="hover:text-dts-maroon">
                          {s.name}{s.edition ? <span className="ml-1 text-slate-400">{s.edition}</span> : null}
                        </Link>
                      ) : (
                        <span className="text-slate-500">{s.name}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{s.count}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{money(s.billed)}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{money(s.cost)}</td>
                    <td className="px-5 py-3 text-right font-semibold">
                      <span className={marginClass(showMargin)}>{money(showMargin)}</span>
                    </td>
                  </tr>
                  {carriers.map((c) => {
                    const cm = c.billed - c.cost;
                    return (
                      <tr key={`${s.id ?? "__none__"}-${c.id ?? "__none__"}`} className="hover:bg-slate-50/60">
                        <td className="py-2.5 pl-10 pr-5 text-slate-600">
                          {c.id ? (
                            <Link href={`/carriers/${c.id}`} className="hover:text-dts-maroon">{c.name}</Link>
                          ) : (
                            <span className="text-slate-400">{c.name}</span>
                          )}
                        </td>
                        <Td right>{c.count}</Td>
                        <Td right>{money(c.billed)}</Td>
                        <Td right>{money(c.cost)}</Td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={cm < 0 ? "text-dts-maroon" : "text-slate-700"}>{money(cm)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <td className="px-5 py-3">Total</td>
              <td className="px-5 py-3" />
              <td className="px-5 py-3 text-right">{money(grand.billed)}</td>
              <td className="px-5 py-3 text-right">{money(grand.cost)}</td>
              <td className="px-5 py-3 text-right">
                <span className={marginClass(grand.billed - grand.cost)}>{money(grand.billed - grand.cost)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* ---- Exhibitor history (global) ----------------------------------------- */

async function ExhibitorHistory() {
  const supabase = await createClient();
  const [exhRes, linkRes, shipRes] = await Promise.all([
    supabase.from("exhibitors").select("id, company_name, industry").order("company_name"),
    supabase.from("show_exhibitors").select("exhibitor_id"),
    supabase.from("shipments").select("exhibitor_id, status"),
  ]);
  const exhibitors = exhRes.data ?? [];
  if (exhibitors.length === 0) return <EmptyCard icon="exhibitors" />;

  const showCount = new Map<string, number>();
  for (const l of linkRes.data ?? []) showCount.set(l.exhibitor_id, (showCount.get(l.exhibitor_id) ?? 0) + 1);
  const shipByExh = new Map<string, { total: number; delivered: number; in_transit: number; issue: number }>();
  for (const s of shipRes.data ?? []) {
    if (!s.exhibitor_id) continue;
    const e = shipByExh.get(s.exhibitor_id) ?? { total: 0, delivered: 0, in_transit: 0, issue: 0 };
    e.total += 1;
    if (s.status === "delivered") e.delivered += 1;
    else if (s.status === "in_transit") e.in_transit += 1;
    else if (s.status === "issue") e.issue += 1;
    shipByExh.set(s.exhibitor_id, e);
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Exhibitor</Th><Th>Industry</Th><Th right>Shows</Th><Th right>Shipments</Th><Th right>Delivered</Th><Th right>In transit</Th><Th right>Issues</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {exhibitors.map((e) => {
              const sh = shipByExh.get(e.id) ?? { total: 0, delivered: 0, in_transit: 0, issue: 0 };
              return (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/exhibitors/${e.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">{e.company_name}</Link>
                  </td>
                  <Td>{e.industry ?? "—"}</Td>
                  <Td right>{showCount.get(e.id) ?? 0}</Td>
                  <Td right>{sh.total}</Td>
                  <Td right>{sh.delivered}</Td>
                  <Td right>{sh.in_transit}</Td>
                  <td className="px-5 py-3 text-right font-medium text-dts-maroon">{sh.issue || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---- Carrier usage (global) --------------------------------------------- */

async function CarrierUsage() {
  const supabase = await createClient();
  const [carRes, shipRes, cvRes] = await Promise.all([
    supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
    supabase.from("shipments").select("carrier_id, show_id"),
    supabase.from("carrier_venues").select("carrier_id, venue_id"),
  ]);
  const carriers = carRes.data ?? [];
  if (carriers.length === 0) return <EmptyCard icon="carriers" />;

  const stats = new Map<string, { shipments: number; shows: Set<string>; venues: Set<string> }>();
  const get = (id: string) => {
    let s = stats.get(id);
    if (!s) { s = { shipments: 0, shows: new Set(), venues: new Set() }; stats.set(id, s); }
    return s;
  };
  for (const s of shipRes.data ?? []) {
    if (!s.carrier_id) continue;
    const g = get(s.carrier_id);
    g.shipments += 1;
    if (s.show_id) g.shows.add(s.show_id);
  }
  for (const cv of cvRes.data ?? []) get(cv.carrier_id).venues.add(cv.venue_id);

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Carrier</Th><Th right>Shipments</Th><Th right>Shows</Th><Th right>Venues serviced</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {carriers.map((c) => {
              const g = stats.get(c.id);
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/carriers/${c.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">{c.carrier_name}</Link>
                  </td>
                  <Td right>{g?.shipments ?? 0}</Td>
                  <Td right>{g?.shows.size ?? 0}</Td>
                  <Td right>{g?.venues.size ?? 0}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---- Exhibitors per show (scoped) --------------------------------------- */

async function ExhibitorsPerShow({ showId }: { showId: string }) {
  const supabase = await createClient();
  const [linkRes, shipRes] = await Promise.all([
    supabase.from("show_exhibitors").select("exhibitor:exhibitors(id, company_name, industry)").eq("show_id", showId),
    supabase.from("shipments").select("exhibitor_id, status").eq("show_id", showId),
  ]);
  const exhibitors = (linkRes.data ?? []).map((r) => r.exhibitor).filter((e): e is NonNullable<typeof e> => Boolean(e));
  if (exhibitors.length === 0) return <EmptyCard icon="exhibitors" label="No exhibitors on this show." />;

  const byExh = new Map<string, ShipmentStatus[]>();
  for (const s of shipRes.data ?? []) {
    if (!s.exhibitor_id) continue;
    const list = byExh.get(s.exhibitor_id) ?? [];
    list.push(s.status);
    byExh.set(s.exhibitor_id, list);
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Exhibitor</Th><Th>Status</Th><Th right>Shipments</Th><Th right>Delivered</Th><Th right>In transit</Th><Th right>Issues</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {exhibitors.sort((a, b) => a.company_name.localeCompare(b.company_name)).map((e) => {
              const statuses = byExh.get(e.id) ?? [];
              const color = rollupShipmentStatus(statuses);
              const rm = ROLLUP_META[color];
              const count = (st: ShipmentStatus) => statuses.filter((x) => x === st).length;
              return (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/exhibitors/${e.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">{e.company_name}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={`h-2 w-2 rounded-full ${rm.dot}`} />
                      <span className={rm.text}>{rm.label}</span>
                    </span>
                  </td>
                  <Td right>{statuses.length}</Td>
                  <Td right>{count("delivered")}</Td>
                  <Td right>{count("in_transit")}</Td>
                  <td className="px-5 py-3 text-right font-medium text-dts-maroon">{count("issue") || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---- Shipments by status (scoped) --------------------------------------- */

async function ShipmentsByStatus({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("shipments").select("status").eq("show_id", showId);
  const ships = data ?? [];
  const total = ships.length;
  if (total === 0) return <EmptyCard icon="shipments" label="No shipments on this show." />;

  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ShipmentStatus, number>;
  for (const s of ships) counts[s.status] += 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs font-medium text-slate-500">{SHIPMENT_STATUS_META[s].label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{counts[s]}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={`Distribution (${total} shipment${total === 1 ? "" : "s"})`} icon="shipments" />
        <div className="p-5">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
            {STATUS_ORDER.map((s) =>
              counts[s] > 0 ? (
                <div
                  key={s}
                  className={SHIPMENT_STATUS_META[s].dot}
                  style={{ width: `${(counts[s] / total) * 100}%` }}
                  title={`${SHIPMENT_STATUS_META[s].label}: ${counts[s]}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-sm ${SHIPMENT_STATUS_META[s].dot}`} />
                {SHIPMENT_STATUS_META[s].label} · {counts[s]}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---- Show summary (scoped) ---------------------------------------------- */

async function ShowSummary({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data: show } = await supabase
    .from("shows_with_status")
    .select("id, show_name, edition_year, status, move_in_start, move_out_end, estimated_revenue, actual_revenue")
    .eq("id", showId)
    .single();
  if (!show) return <EmptyCard icon="shows" label="Show not found." />;

  const [exhRes, shipRes, debriefRes] = await Promise.all([
    supabase.from("show_exhibitors").select("exhibitor_id", { count: "exact" }).eq("show_id", showId),
    supabase.from("shipments").select("status, carrier:carriers(id, carrier_name)").eq("show_id", showId),
    supabase.from("show_debriefs").select("*").eq("show_id", showId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const ships = shipRes.data ?? [];
  const statusCounts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ShipmentStatus, number>;
  const carriers = new Map<string, string>();
  for (const s of ships) {
    statusCounts[s.status] += 1;
    if (s.carrier) carriers.set(s.carrier.id, s.carrier.carrier_name);
  }
  const meta = SHOW_STATUS_META[show.status ?? "upcoming"];
  const debrief = debriefRes.data;
  const variance = show.estimated_revenue != null && show.actual_revenue != null ? show.actual_revenue - show.estimated_revenue : null;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/shows/${show.id}`} className="font-heading text-lg font-semibold text-slate-900 hover:text-dts-maroon">
              {show.show_name}{show.edition_year ? <span className="ml-1 text-slate-400">{show.edition_year}</span> : null}
            </Link>
            <div className="mt-0.5 text-sm text-slate-500">{formatDateRange(show.move_in_start, show.move_out_end)}</div>
          </div>
          <Badge className={meta.badge}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Exhibitors" value={exhRes.count ?? 0} />
        <Stat label="Shipments" value={ships.length} />
        <Stat label="Carriers" value={carriers.size} />
        <Stat label="Issues" value={statusCounts.issue} accent={statusCounts.issue > 0 ? "text-dts-maroon" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shipments by status" icon="shipments" />
          <ul className="divide-y divide-slate-100">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${SHIPMENT_STATUS_META[s].dot}`} />
                  {SHIPMENT_STATUS_META[s].label}
                </span>
                <span className="font-medium text-slate-800">{statusCounts[s]}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Revenue" icon="reports" />
          <dl className="divide-y divide-slate-100 text-sm">
            <SummaryRow label="Estimated" value={formatCurrency(show.estimated_revenue)} />
            <SummaryRow label="Actual" value={formatCurrency(show.actual_revenue)} />
            <SummaryRow label="Variance" value={variance == null ? "—" : `${variance >= 0 ? "+" : "−"}${formatCurrency(Math.abs(variance))}`} />
          </dl>
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Carriers used</div>
            <div className="text-sm text-slate-700">
              {carriers.size === 0 ? <span className="text-slate-400">None</span> : [...carriers.values()].join(", ")}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Debrief" icon="reports" />
        {!debrief ? (
          <EmptyState icon="reports" title="No debrief logged" description="Add one from the show's Debrief tab." />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
            <DebriefField label="What went well" value={debrief.what_went_well} />
            <DebriefField label="What went wrong" value={debrief.what_went_wrong} />
            <DebriefField label="Carrier performance" value={debrief.carrier_performance_notes} />
            <DebriefField label="Venue issues" value={debrief.venue_issues} />
            <DebriefField label="Recommendations next year" value={debrief.recommendations_next_year} className="sm:col-span-2" />
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---- small shared bits --------------------------------------------------- */

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</div>
    </Card>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
function DebriefField({ label, value, className = "" }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <p className="whitespace-pre-wrap text-slate-700">{value || <span className="text-slate-300">—</span>}</p>
    </div>
  );
}
function EmptyCard({ icon, label }: { icon: Parameters<typeof EmptyState>[0]["icon"]; label?: string }) {
  return (
    <Card>
      <EmptyState icon={icon} title={label ?? "No data yet"} />
    </Card>
  );
}
