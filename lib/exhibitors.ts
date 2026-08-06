/**
 * Sales-book metadata for the exhibitor directory: how the legacy sales status
 * and priority tier render as badges, plus the option lists the edit form uses.
 * Kept alongside SHOW_STATUS_META / SHIPMENT_STATUS_META for a consistent look.
 */

export type SalesStatus = "active" | "dormant" | "not_in_tms";

export const SALES_STATUS_META: Record<
  SalesStatus,
  { label: string; dot: string; badge: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  dormant: {
    label: "Dormant",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  not_in_tms: {
    label: "Not in TMS",
    dot: "bg-dts-midgrey",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
  },
};

export const SALES_STATUS_OPTIONS: { value: SalesStatus; label: string }[] = [
  { value: "active", label: "Active — shipped last 12 mo" },
  { value: "dormant", label: "Dormant — in TMS, no recent loads" },
  { value: "not_in_tms", label: "Not in current TMS" },
];

export type PriorityTier = "A" | "B" | "C" | "D" | "Internal";

export const PRIORITY_TIER_META: Record<
  PriorityTier,
  { label: string; badge: string }
> = {
  A: { label: "A", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" },
  B: { label: "B", badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25" },
  C: { label: "C", badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20" },
  D: { label: "D", badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30" },
  Internal: {
    label: "Internal",
    badge: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20",
  },
};

export const PRIORITY_TIER_OPTIONS: { value: PriorityTier; label: string }[] = [
  { value: "A", label: "A — Warm, high value" },
  { value: "B", label: "B — Warm / lapsed" },
  { value: "C", label: "C — Cold, was high value" },
  { value: "D", label: "D — Cold / low value" },
  { value: "Internal", label: "Internal" },
];

export function salesStatusMeta(v: string | null | undefined) {
  return v && v in SALES_STATUS_META
    ? SALES_STATUS_META[v as SalesStatus]
    : null;
}

export function priorityTierMeta(v: string | null | undefined) {
  return v && v in PRIORITY_TIER_META
    ? PRIORITY_TIER_META[v as PriorityTier]
    : null;
}
