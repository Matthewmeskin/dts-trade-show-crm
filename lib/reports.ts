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
