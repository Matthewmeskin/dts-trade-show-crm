import type { Enums } from "@/lib/database.types";

export type TaskStatus = Enums<"task_status">;
export type TaskPriority = Enums<"task_priority">;

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; badge: string; text: string }
> = {
  open: {
    label: "Open",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
    text: "text-slate-500",
  },
  in_progress: {
    label: "In progress",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
    text: "text-dts-blue",
  },
  completed: {
    label: "Completed",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    text: "text-emerald-600",
  },
};

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; badge: string }
> = {
  high: {
    label: "High",
    badge: "bg-dts-maroon/10 text-dts-maroon ring-1 ring-inset ring-dts-maroon/25",
  },
  medium: {
    label: "Medium",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  low: {
    label: "Low",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
  },
};

/** The five record types a task can be related to. */
export const TASK_RELATIONS = [
  { key: "related_show_id", param: "show", label: "Show", path: "shows" },
  { key: "related_exhibitor_id", param: "exhibitor", label: "Exhibitor", path: "exhibitors" },
  { key: "related_shipment_id", param: "shipment", label: "Shipment", path: "shipments" },
  { key: "related_carrier_id", param: "carrier", label: "Carrier", path: "carriers" },
  { key: "related_venue_id", param: "venue", label: "Venue", path: "venues" },
] as const;
