import type { IconName } from "@/components/icons";
import { todayYMD } from "@/lib/format";

export type ReportDef = {
  slug: string;
  title: string;
  description: string;
  scoped: boolean; // requires a selected show
  icon: IconName;
};

export const REPORTS: ReportDef[] = [
  {
    slug: "exhibitors-per-show",
    title: "Exhibitors per show",
    description: "Exhibitors at a show with shipment counts and status.",
    scoped: true,
    icon: "exhibitors",
  },
  {
    slug: "shipments-by-status",
    title: "Shipments by status",
    description: "Shipment breakdown by status for a show.",
    scoped: true,
    icon: "shipments",
  },
  {
    slug: "show-summary",
    title: "Show summary",
    description: "Exhibitors, shipments, carriers, and debrief for one show.",
    scoped: true,
    icon: "shows",
  },
  {
    slug: "exhibitor-history",
    title: "Exhibitor history",
    description: "Every exhibitor's footprint across all shows.",
    scoped: false,
    icon: "exhibitors",
  },
  {
    slug: "carrier-usage",
    title: "Carrier usage",
    description: "Carrier activity by show and venue.",
    scoped: false,
    icon: "carriers",
  },
  {
    slug: "financials",
    title: "Financials by show & carrier",
    description: "Billed, cost, and margin per show, broken down by carrier.",
    scoped: false,
    icon: "reports",
  },
];

export function getReport(slug: string): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

/* ---- Report period ------------------------------------------------------ */

export type DatePreset = { label: string; from: string; to: string };
export type DateRange = { from: string | null; to: string | null };

const QUARTER_END = ["03-31", "06-30", "09-30", "12-31"];

/**
 * Quick periods for every report: this year to date, each quarter of this
 * year and last (newest first, only quarters that have started), and last
 * year in full. Built from the company's (Pacific) calendar day, so "this
 * quarter" doesn't roll over early on the evening of a quarter's last day.
 */
export function datePresets(today: string = todayYMD()): DatePreset[] {
  const year = Number(today.slice(0, 4));
  const thisQuarter = Math.ceil(Number(today.slice(5, 7)) / 3);
  const out: DatePreset[] = [{ label: `${year} year to date`, from: `${year}-01-01`, to: today }];
  for (const y of [year, year - 1]) {
    for (let q = y === year ? thisQuarter : 4; q >= 1; q--) {
      out.push({ label: `Q${q} ${y}`, from: `${y}-${String(q * 3 - 2).padStart(2, "0")}-01`, to: `${y}-${QUARTER_END[q - 1]}` });
    }
  }
  out.push({ label: `All of ${year - 1}`, from: `${year - 1}-01-01`, to: `${year - 1}-12-31` });
  return out;
}

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** The period from the URL: real dates only, either end may be open, a reversed range is put the right way round. */
export function readRange(from: string | undefined, to: string | undefined): DateRange {
  const f = from && YMD.test(from) ? from : null;
  const t = to && YMD.test(to) ? to : null;
  return f && t && f > t ? { from: t, to: f } : { from: f, to: t };
}

/** Whether a day (YYYY-MM-DD) falls in the period; an undated row is only in an open period. */
export function inRange(day: string | null | undefined, r: DateRange): boolean {
  if (!r.from && !r.to) return true;
  if (!day) return false;
  const d = day.slice(0, 10);
  return (!r.from || d >= r.from) && (!r.to || d <= r.to);
}

/** The URL query for a report view, keeping the show and the period together. */
export function reportQuery(p: { show?: string | null; from?: string | null; to?: string | null }): string {
  const q = new URLSearchParams();
  if (p.show) q.set("show", p.show);
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  const s = q.toString();
  return s ? `?${s}` : "";
}
