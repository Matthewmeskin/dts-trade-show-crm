import { pacificDayKey } from "@/lib/format";
import type { IconName } from "@/components/icons";

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

export type DatePreset = { label: string; from: string; to: string };

const QUARTER_END = ["03-31", "06-30", "09-30", "12-31"];

/**
 * Quick ranges for the financials filter: year-to-date plus each quarter of
 * this year and last, newest first.
 *
 * Built from the Pacific date rather than the server's UTC clock — the servers
 * run UTC, so on the evening of a quarter's last day "this quarter" would
 * otherwise roll forward while it's still that quarter in the office.
 */
export function datePresets(): DatePreset[] {
  const today = pacificDayKey(new Date().toISOString()) ?? "";
  const year = Number(today.slice(0, 4));
  const thisQuarter = Math.ceil(Number(today.slice(5, 7)) / 3);

  const out: DatePreset[] = [
    { label: `${year} year to date`, from: `${year}-01-01`, to: today },
  ];
  for (const y of [year, year - 1]) {
    // Only quarters that have started; a future quarter is always empty.
    for (let q = y === year ? thisQuarter : 4; q >= 1; q--) {
      out.push({
        label: `Q${q} ${y}`,
        from: `${y}-${String(q * 3 - 2).padStart(2, "0")}-01`,
        to: `${y}-${QUARTER_END[q - 1]}`,
      });
    }
  }
  return out;
}
