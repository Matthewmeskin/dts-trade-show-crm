import type { Enums } from "@/lib/database.types";

export type ShipmentStatus = Enums<"shipment_status">;
export type ShipmentMode = Enums<"shipment_mode">;
export type ShipmentDestination = Enums<"shipment_destination">;
export type TmsSyncStatus = Enums<"tms_sync_status">;

export const DESTINATION_LABELS: Record<ShipmentDestination, string> = {
  advance_warehouse: "Advance warehouse",
  direct_to_show: "Direct to show",
};

/** TMS / BrokerWareLite sync state indicator. */
export const TMS_SYNC_META: Record<
  TmsSyncStatus,
  { label: string; badge: string }
> = {
  synced: {
    label: "Synced",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  manual: {
    label: "Manual",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
  },
  pending: {
    label: "Pending",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  error: {
    label: "Error",
    badge: "bg-dts-maroon/10 text-dts-maroon ring-1 ring-inset ring-dts-maroon/25",
  },
};

export const SHIPMENT_STATUS_META: Record<
  ShipmentStatus,
  { label: string; badge: string; dot: string }
> = {
  quoted: {
    label: "Quoted",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
    dot: "bg-dts-midgrey",
  },
  booked: {
    label: "Booked",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
    dot: "bg-dts-blue",
  },
  in_transit: {
    label: "In transit",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    dot: "bg-amber-500",
  },
  delivered: {
    label: "Delivered",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  issue: {
    label: "Issue",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
    dot: "bg-red-500",
  },
};

/**
 * Roll a set of shipment statuses up into a single traffic-light indicator for
 * an exhibitor at a show:
 *   red    — any shipment has an issue, OR nothing is booked at all
 *   green  — there are shipments and all are delivered
 *   yellow — anything in between (booked / quoted / in transit)
 */
export type RollupColor = "green" | "yellow" | "red";

export const ROLLUP_META: Record<
  RollupColor,
  { label: string; dot: string; text: string }
> = {
  green: { label: "On track", dot: "bg-emerald-500", text: "text-emerald-700" },
  yellow: { label: "In progress", dot: "bg-amber-500", text: "text-amber-700" },
  red: { label: "Needs attention", dot: "bg-red-500", text: "text-red-700" },
};

export function rollupShipmentStatus(statuses: ShipmentStatus[]): RollupColor {
  if (statuses.length === 0) return "red"; // nothing booked
  if (statuses.includes("issue")) return "red";
  if (statuses.every((s) => s === "delivered")) return "green";
  return "yellow";
}
