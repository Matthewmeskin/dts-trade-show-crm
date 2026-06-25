import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { HoverPreview } from "@/components/hover-preview";
import { ShipmentSidePanel } from "@/app/(app)/shipments/shipment-side-panel";
import { SHOW_STATUS_META, type ShowWithStatus, type ShowStatus } from "@/lib/shows";
import {
  SHIPMENT_STATUS_META,
  DIRECTION_META,
  type ShipmentStatus,
  type ShipmentDirection,
} from "@/lib/shipments";
import { parseDate, today as todayDate, formatDateRange, formatDate } from "@/lib/format";
import { Constants } from "@/lib/database.types";

const STATUSES = Constants.public.Enums.shipment_status;
type StatusFilter = ShipmentStatus | "all";
type DirFilter = ShipmentDirection | "all";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type View = "month" | "week" | "shows";
type Basis = "pickup" | "delivery";
type LabelMode = "pro" | "exhibitor";
type ColorMode = "status" | "direction";

const NEUTRAL_META = { dot: "bg-slate-300", text: "text-slate-400" };

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay()); // Sunday
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type CalEvent = {
  id: string;
  label: string;
  status: ShipmentStatus;
  exhibitor: string | null;
  show: string | null;
  direction: ShipmentDirection | null;
  carrier: string | null;
  venue: string | null;
  pickup: string | null;
  delivery: string | null;
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; by?: string; label?: string; color?: string; status?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const view: View = sp.view === "week" || sp.view === "shows" ? sp.view : "month";
  const basis: Basis = sp.by === "delivery" ? "delivery" : "pickup";
  const labelMode: LabelMode = sp.label === "pro" ? "pro" : "exhibitor";
  const colorMode: ColorMode = sp.color === "direction" ? "direction" : "status";
  const statusFilter: StatusFilter =
    sp.status && (STATUSES as readonly string[]).includes(sp.status) ? (sp.status as ShipmentStatus) : "all";
  const dirFilter: DirFilter =
    sp.dir === "move_in" || sp.dir === "move_out" ? sp.dir : "all";
  const today = todayDate();
  const anchor = parseDate(sp.date) ?? today;

  // Preserve params when building control links.
  const href = (
    over: Partial<{ view: View; date: string; by: Basis; label: LabelMode; color: ColorMode; status: StatusFilter; dir: DirFilter }>,
  ) => {
    const p = new URLSearchParams();
    p.set("view", over.view ?? view);
    p.set("date", over.date ?? ymd(anchor));
    p.set("by", over.by ?? basis);
    p.set("label", over.label ?? labelMode);
    p.set("color", over.color ?? colorMode);
    p.set("status", over.status ?? statusFilter);
    p.set("dir", over.dir ?? dirFilter);
    return `/calendar?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Shipments by date — color-coded by status."
      />

      {/* Control bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view !== "shows" ? (
            <>
              <NavLink href={href({ date: ymd(shiftAnchor(anchor, view, -1)) })} icon="‹" />
              <Link
                href={href({ date: ymd(today) })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Today
              </Link>
              <NavLink href={href({ date: ymd(shiftAnchor(anchor, view, 1)) })} icon="›" />
              <span className="ml-2 font-heading text-base font-semibold text-slate-900">
                {periodLabel(anchor, view)}
              </span>
            </>
          ) : (
            <span className="font-heading text-base font-semibold text-slate-900">
              Shows timeline
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view !== "shows" ? (
            <>
              <Segmented
                options={[
                  { label: "Pickup date", href: href({ by: "pickup" }), active: basis === "pickup" },
                  { label: "Delivery date", href: href({ by: "delivery" }), active: basis === "delivery" },
                ]}
              />
              <Segmented
                options={[
                  { label: "PRO #", href: href({ label: "pro" }), active: labelMode === "pro" },
                  { label: "Exhibitor", href: href({ label: "exhibitor" }), active: labelMode === "exhibitor" },
                ]}
              />
              <Segmented
                options={[
                  { label: "Status", href: href({ color: "status" }), active: colorMode === "status" },
                  { label: "Direction", href: href({ color: "direction" }), active: colorMode === "direction" },
                ]}
              />
            </>
          ) : null}
          <Segmented
            options={[
              { label: "Month", href: href({ view: "month" }), active: view === "month" },
              { label: "Week", href: href({ view: "week" }), active: view === "week" },
              { label: "Shows", href: href({ view: "shows" }), active: view === "shows" },
            ]}
          />
        </div>
      </div>

      {/* Filter bar — narrow the calendar to a status and/or direction. */}
      {view !== "shows" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Filter</span>
          <Segmented
            options={[
              { label: "All status", href: href({ status: "all" }), active: statusFilter === "all" },
              ...STATUSES.map((s) => ({
                label: SHIPMENT_STATUS_META[s].label,
                href: href({ status: s }),
                active: statusFilter === s,
              })),
            ]}
          />
          <Segmented
            options={[
              { label: "All directions", href: href({ dir: "all" }), active: dirFilter === "all" },
              { label: DIRECTION_META.move_in.label, href: href({ dir: "move_in" }), active: dirFilter === "move_in" },
              { label: DIRECTION_META.move_out.label, href: href({ dir: "move_out" }), active: dirFilter === "move_out" },
            ]}
          />
        </div>
      ) : null}

      {view === "shows" ? (
        <ShowsTimeline />
      ) : (
        <ShipmentCalendar
          view={view}
          anchor={anchor}
          today={today}
          basis={basis}
          labelMode={labelMode}
          colorMode={colorMode}
          statusFilter={statusFilter}
          dirFilter={dirFilter}
        />
      )}

      {view === "shows" ? (
        <ShowLegend />
      ) : colorMode === "direction" ? (
        <DirectionLegend />
      ) : (
        <ShipmentLegend />
      )}
    </div>
  );
}

function shiftAnchor(anchor: Date, view: View, dir: number): Date {
  if (view === "week") return addDays(anchor, 7 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}
function periodLabel(anchor: Date, view: View): string {
  if (view === "week") {
    const s = startOfWeek(anchor);
    const e = addDays(s, 6);
    return formatDateRange(ymd(s), ymd(e));
  }
  return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

/* -------------------------------------------------------------------------- */
/* Shipment calendar (month / week)                                            */
/* -------------------------------------------------------------------------- */

async function ShipmentCalendar({
  view,
  anchor,
  today,
  basis,
  labelMode,
  colorMode,
  statusFilter,
  dirFilter,
}: {
  view: "month" | "week";
  anchor: Date;
  today: Date;
  basis: Basis;
  labelMode: LabelMode;
  colorMode: ColorMode;
  statusFilter: StatusFilter;
  dirFilter: DirFilter;
}) {
  const supabase = await createClient();

  // Grid range: month → 6 weeks from the Sunday before the 1st; week → that week.
  const gridStart =
    view === "week"
      ? startOfWeek(anchor)
      : startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const rows = view === "week" ? 1 : 6;
  const gridEnd = addDays(gridStart, rows * 7 - 1);
  const startISO = ymd(gridStart);
  const endISO = ymd(gridEnd);

  // Fetch shipments whose chosen date falls in the visible window.
  let query = supabase
    .from("shipments")
    .select(
      "id, status, direction, pickup_date, estimated_delivery_date, actual_delivery_date, pro_number, exhibitor:exhibitors(company_name), show:shows(show_name), carrier:carriers(carrier_name), venue:venues(venue_name)",
    );
  if (basis === "pickup") {
    query = query.gte("pickup_date", startISO).lte("pickup_date", endISO);
  } else {
    query = query.or(
      `and(actual_delivery_date.gte.${startISO},actual_delivery_date.lte.${endISO}),and(actual_delivery_date.is.null,estimated_delivery_date.gte.${startISO},estimated_delivery_date.lte.${endISO})`,
    );
  }
  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (dirFilter !== "all") query = query.eq("direction", dirFilter);
  const { data } = await query;
  const rowsData = data ?? [];

  // Bucket events by day.
  const byDay = new Map<string, CalEvent[]>();
  for (const s of rowsData) {
    const dateStr =
      basis === "pickup"
        ? s.pickup_date
        : s.actual_delivery_date ?? s.estimated_delivery_date;
    if (!dateStr) continue;
    const key = dateStr.slice(0, 10);
    const exhibitor = s.exhibitor?.company_name ?? null;
    const label =
      labelMode === "pro"
        ? s.pro_number
          ? `PRO ${s.pro_number}`
          : exhibitor || "Shipment"
        : exhibitor || (s.pro_number ? `PRO ${s.pro_number}` : "Shipment");
    const list = byDay.get(key) ?? [];
    list.push({
      id: s.id,
      label,
      status: s.status,
      exhibitor,
      show: s.show?.show_name ?? null,
      direction: s.direction,
      carrier: s.carrier?.carrier_name ?? null,
      venue: s.venue?.venue_name ?? null,
      pickup: s.pickup_date,
      delivery: s.actual_delivery_date ?? s.estimated_delivery_date,
    });
    byDay.set(key, list);
  }

  const totalEvents = rowsData.length;
  const cells: Date[] = [];
  for (let i = 0; i < rows * 7; i++) cells.push(addDays(gridStart, i));

  return (
    <Card className="overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DOW.map((d) => (
          <div key={d} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const key = ymd(cell);
          const events = byDay.get(key) ?? [];
          const inMonth = view === "week" || cell.getMonth() === anchor.getMonth();
          const isToday = sameDay(cell, today);
          const cap = view === "week" ? 12 : 4;
          return (
            <div
              key={key}
              className={`border-b border-r border-slate-100 p-1.5 ${
                inMonth ? "bg-white" : "bg-slate-50/50"
              } ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}
              style={{ minHeight: view === "week" ? 320 : 104 }}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={`text-xs font-medium ${
                    isToday
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-dts-maroon text-white"
                      : inMonth
                        ? "text-slate-600"
                        : "text-slate-300"
                  }`}
                >
                  {cell.getDate()}
                </span>
                {view === "month" && cell.getDate() === 1 ? (
                  <span className="text-[10px] font-medium text-slate-400">{MONTHS_SHORT[cell.getMonth()]}</span>
                ) : null}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, cap).map((e) => {
                  const statusMeta = SHIPMENT_STATUS_META[e.status];
                  const meta =
                    colorMode === "direction"
                      ? e.direction
                        ? DIRECTION_META[e.direction]
                        : NEUTRAL_META
                      : statusMeta;
                  return (
                    <HoverPreview
                      key={e.id}
                      className="block"
                      label={
                        <ShipmentSidePanel
                          id={e.id}
                          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-50"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                          <span className={`truncate text-xs font-medium ${meta.text}`}>{e.label}</span>
                        </ShipmentSidePanel>
                      }
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{e.exhibitor ?? e.label}</span>
                          <Badge className={statusMeta.badge}>{statusMeta.label}</Badge>
                        </div>
                        <dl className="space-y-1 text-xs">
                          {e.show ? <CalRow label="Show" value={e.show} /> : null}
                          {e.direction ? <CalRow label="Direction" value={DIRECTION_META[e.direction].label} /> : null}
                          {e.venue ? <CalRow label="Venue" value={e.venue} /> : null}
                          {e.carrier ? <CalRow label="Carrier" value={e.carrier} /> : null}
                          <CalRow label="Pickup" value={formatDate(e.pickup)} />
                          <CalRow label="Delivery" value={formatDate(e.delivery)} />
                        </dl>
                      </div>
                    </HoverPreview>
                  );
                })}
                {events.length > cap ? (
                  <div className="px-1 text-[11px] font-medium text-slate-400">
                    +{events.length - cap} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {totalEvents === 0 ? (
        <div className="border-t border-slate-100">
          <EmptyState
            icon="shipments"
            title="No shipments in this range"
            description={`No shipments with a ${basis} date in ${periodLabel(anchor, view)}.`}
          />
        </div>
      ) : null}
    </Card>
  );
}

function DirectionLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {(["move_in", "move_out"] as const).map((d) => {
        const meta = DIRECTION_META[d];
        return (
          <span key={d} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        );
      })}
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={`h-2.5 w-2.5 rounded-full ${NEUTRAL_META.dot}`} />
        Unset
      </span>
    </div>
  );
}

function CalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="truncate text-right text-slate-700">{value}</dd>
    </div>
  );
}

function ShipmentLegend() {
  const order: ShipmentStatus[] = ["quoted", "booked", "in_transit", "delivered", "issue"];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {order.map((s) => {
        const meta = SHIPMENT_STATUS_META[s];
        return (
          <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small control components                                                    */
/* -------------------------------------------------------------------------- */

function NavLink({ href, icon }: { href: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-600 hover:bg-slate-100"
    >
      {icon}
    </Link>
  );
}

function Segmented({ options }: { options: { label: string; href: string; active: boolean }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {options.map((o) => (
        <Link
          key={o.label}
          href={o.href}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            o.active ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shows timeline (legacy Gantt view)                                          */
/* -------------------------------------------------------------------------- */

const PX_PER_DAY = 9;
const ROW_H = 36;

async function ShowsTimeline() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shows_with_status")
    .select("id, show_name, edition_year, status, advance_warehouse_open, move_in_start, move_in_end, move_out_end");
  const shows = (data ?? []) as ShowWithStatus[];

  const dated: { show: ShowWithStatus; start: Date; end: Date }[] = [];
  let undated = 0;
  for (const s of shows) {
    const start = parseDate(s.advance_warehouse_open) ?? parseDate(s.move_in_start);
    const end = parseDate(s.move_out_end) ?? parseDate(s.move_in_end) ?? start;
    if (start && end) dated.push({ show: s, start, end: end < start ? start : end });
    else undated += 1;
  }

  if (dated.length === 0) {
    return (
      <Card>
        <EmptyState icon="calendar" title="No dated shows yet" description="Create a show with dates to see it here." />
      </Card>
    );
  }

  const minStart = new Date(Math.min(...dated.map((d) => d.start.getTime())));
  const maxEnd = new Date(Math.max(...dated.map((d) => d.end.getTime())));
  const rangeStart = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  const rangeEnd = new Date(maxEnd.getFullYear(), maxEnd.getMonth() + 1, 0);
  const dayIndex = (d: Date) => Math.round((d.getTime() - rangeStart.getTime()) / DAY_MS);
  const width = (dayIndex(rangeEnd) + 1) * PX_PER_DAY;

  const sorted = [...dated].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = [];
  const positioned = sorted.map(({ show, start, end }) => {
    const startIdx = dayIndex(start);
    let lane = laneEnds.findIndex((endIdx) => endIdx < startIdx);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(dayIndex(end)); }
    else laneEnds[lane] = dayIndex(end);
    return { show, start, end, lane };
  });
  const laneCount = laneEnds.length;

  const months: { left: number; width: number; label: string }[] = [];
  for (let m = new Date(rangeStart); m <= rangeEnd; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    months.push({ left: dayIndex(m) * PX_PER_DAY, width: daysInMonth * PX_PER_DAY, label: `${MONTHS_SHORT[m.getMonth()]} ${m.getFullYear()}` });
  }
  const today = todayDate();
  const todayLeft = today >= rangeStart && today <= rangeEnd ? dayIndex(today) * PX_PER_DAY : null;

  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <div style={{ width }} className="relative">
          <div className="relative mb-1 h-7">
            {months.map((m) => (
              <div key={m.label} style={{ left: m.left, width: m.width }} className="absolute top-0 border-l border-slate-200 pl-2 text-xs font-medium text-slate-500">
                {m.label}
              </div>
            ))}
          </div>
          <div className="relative" style={{ height: laneCount * ROW_H + 6 }}>
            {months.map((m) => (
              <div key={`g-${m.label}`} style={{ left: m.left }} className="absolute top-0 bottom-0 border-l border-slate-100" />
            ))}
            {todayLeft != null ? (
              <div style={{ left: todayLeft }} className="absolute top-0 bottom-0 z-10 w-px bg-dts-maroon">
                <span className="absolute left-1 text-[10px] font-semibold text-dts-maroon">Today</span>
              </div>
            ) : null}
            {positioned.map(({ show, start, end, lane }) => {
              const left = dayIndex(start) * PX_PER_DAY;
              const barWidth = Math.max((dayIndex(end) - dayIndex(start) + 1) * PX_PER_DAY, 10);
              const meta = SHOW_STATUS_META[(show.status ?? "upcoming") as ShowStatus];
              return (
                <Link key={show.id} href={`/shows/${show.id}`} title={show.show_name ?? ""} style={{ left, width: barWidth, top: lane * ROW_H + 4 }} className={`absolute flex h-7 items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90 ${meta.bar}`}>
                  <span className="truncate">{show.show_name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {undated > 0 ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">{undated} show{undated === 1 ? "" : "s"} not shown — no dates set.</p>
      ) : null}
    </Card>
  );
}

function ShowLegend() {
  const items: ShowStatus[] = ["upcoming", "active", "completed", "archived"];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {items.map((s) => {
        const meta = SHOW_STATUS_META[s];
        return (
          <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-sm ${meta.bar}`} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
