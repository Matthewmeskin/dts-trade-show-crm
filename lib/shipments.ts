import type { Enums } from "@/lib/database.types";
import { daysUntil } from "@/lib/format";

export type ShipmentStatus = Enums<"shipment_status">;
export type ShipmentMode = Enums<"shipment_mode">;
export type ShipmentDestination = Enums<"shipment_destination">;
export type ShipmentDirection = Enums<"shipment_direction">;
export type TmsSyncStatus = Enums<"tms_sync_status">;

export const DESTINATION_LABELS: Record<ShipmentDestination, string> = {
  advance_warehouse: "Advance warehouse",
  direct_to_show: "Direct to show",
};

/** Move-in (freight into the show) vs move-out (back from it). */
export const DIRECTION_META: Record<
  ShipmentDirection,
  { label: string; badge: string; dot: string; text: string }
> = {
  move_in: {
    label: "Move-in",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
    dot: "bg-dts-blue",
    text: "text-dts-blue",
  },
  move_out: {
    label: "Move-out",
    badge: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20",
    dot: "bg-purple-500",
    text: "text-purple-600",
  },
};

/**
 * Best-effort default direction from the route. Both destination types are
 * deliveries INTO a show, so they imply a move-in; move-outs are set explicitly
 * (the Load Finder import infers them from a venue pickup).
 */
export function deriveDirection(
  destination_type: ShipmentDestination | null | undefined,
): ShipmentDirection | null {
  return destination_type ? "move_in" : null;
}

export function effectiveDirection(s: {
  direction: ShipmentDirection | null;
  destination_type: ShipmentDestination | null;
}): ShipmentDirection | null {
  return s.direction ?? deriveDirection(s.destination_type);
}

type ShowDates = {
  advance_warehouse_cutoff?: string | null;
  move_in_start?: string | null;
  move_out_start?: string | null;
  move_out_end?: string | null;
};

/** The show-derived must-deliver-by date for a direction. */
export function derivedTargetDate(
  direction: ShipmentDirection | null,
  show: ShowDates | null | undefined,
): string | null {
  if (!show) return null;
  if (direction === "move_out") return show.move_out_end ?? show.move_out_start ?? null;
  return show.advance_warehouse_cutoff ?? show.move_in_start ?? null;
}

/** Manual target wins; otherwise derive from the linked show. */
export function effectiveTargetDate(
  s: {
    target_delivery_date: string | null;
    direction: ShipmentDirection | null;
    destination_type: ShipmentDestination | null;
  },
  show: ShowDates | null | undefined,
): string | null {
  return s.target_delivery_date ?? derivedTargetDate(effectiveDirection(s), show);
}

/** Manual show date wins; otherwise the show's move-in/out date. */
export function effectiveShowDate(
  s: {
    show_date: string | null;
    direction: ShipmentDirection | null;
    destination_type: ShipmentDestination | null;
  },
  show: ShowDates | null | undefined,
): string | null {
  if (s.show_date) return s.show_date;
  if (!show) return null;
  return effectiveDirection(s) === "move_out"
    ? show.move_out_start ?? show.move_out_end ?? null
    : show.move_in_start ?? null;
}

/**
 * Is a shipment on track to be delivered by its target? Compares the carrier's
 * estimated (or actual) delivery against the must-deliver-by target.
 */
export type DeliveryHealth =
  | "delivered"
  | "late"
  | "overdue"
  | "at_risk"
  | "due_soon"
  | "on_track"
  | "scheduled"
  | "issue"
  | "no_target";

export const DELIVERY_HEALTH_META: Record<
  DeliveryHealth,
  { label: string; badge: string; dot: string; rank: number }
> = {
  overdue: { label: "Overdue", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20", dot: "bg-red-500", rank: 6 },
  at_risk: { label: "At risk", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20", dot: "bg-red-500", rank: 5 },
  issue: { label: "Issue", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20", dot: "bg-red-500", rank: 5 },
  due_soon: { label: "Due soon", badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20", dot: "bg-amber-500", rank: 4 },
  late: { label: "Delivered late", badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20", dot: "bg-amber-500", rank: 3 },
  on_track: { label: "On track", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20", dot: "bg-emerald-500", rank: 1 },
  scheduled: { label: "Scheduled", badge: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20", dot: "bg-slate-400", rank: 1 },
  delivered: { label: "Delivered", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20", dot: "bg-emerald-500", rank: 0 },
  no_target: { label: "No target", badge: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/20", dot: "bg-slate-300", rank: 0 },
};

export function deliveryHealth(args: {
  status: ShipmentStatus;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  target: string | null;
}): DeliveryHealth {
  const { status, estimatedDelivery, actualDelivery, target } = args;
  const delivered = status === "delivered" || !!actualDelivery;
  if (delivered) {
    if (target && actualDelivery && actualDelivery.slice(0, 10) > target.slice(0, 10)) return "late";
    return "delivered";
  }
  if (status === "issue") return "issue";
  if (!target) return "no_target";
  const t = target.slice(0, 10);
  const eta = estimatedDelivery?.slice(0, 10) ?? null;
  const daysToTarget = daysUntil(t);
  if (eta && eta > t) return "at_risk"; // projected to miss the deadline
  if (daysToTarget != null && daysToTarget < 0) return "overdue"; // deadline passed, undelivered
  if (eta && eta <= t) return daysToTarget != null && daysToTarget <= 2 ? "due_soon" : "on_track";
  // No ETA yet.
  return daysToTarget != null && daysToTarget <= 2 ? "due_soon" : "scheduled";
}

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
  { label: string; badge: string; dot: string; text: string }
> = {
  quoted: {
    label: "Quoted",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
    dot: "bg-dts-midgrey",
    text: "text-dts-midgrey",
  },
  booked: {
    label: "Booked",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
    dot: "bg-dts-blue",
    text: "text-dts-blue",
  },
  in_transit: {
    label: "In transit",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    dot: "bg-amber-500",
    text: "text-amber-600",
  },
  delivered: {
    label: "Delivered",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
  },
  issue: {
    label: "Issue",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
    dot: "bg-red-500",
    text: "text-dts-maroon",
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
