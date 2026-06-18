import { Constants, type TablesInsert } from "@/lib/database.types";

/**
 * TMS ingest mapping for Hyperion TMS (3pl.hyperiontms.com) tracking payloads.
 *
 * n8n GETs Hyperion's tracking endpoint and POSTs the resulting JSON array to
 * our /api/tms/shipments endpoint. This module normalizes one Hyperion load
 * object into a shipments upsert keyed by load number (clientLoadId ->
 * shipments.tms_reference_id). It also accepts generic field names so other
 * sources / hand-built payloads work too.
 */

type Enum<T> = readonly T[];
const inEnum = <T extends string>(v: unknown, allowed: Enum<T>): v is T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v);

/** Map common TMS status strings to our shipment_status enum. */
const STATUS_MAP: Record<string, (typeof Constants.public.Enums.shipment_status)[number]> = {
  quoted: "quoted", quote: "quoted",
  booked: "booked", tendered: "booked", dispatched: "booked", assigned: "booked", scheduled: "booked",
  in_transit: "in_transit", "in transit": "in_transit", intransit: "in_transit",
  "picked up": "in_transit", picked_up: "in_transit", "out for delivery": "in_transit", "en route": "in_transit", enroute: "in_transit",
  delivered: "delivered", complete: "delivered", completed: "delivered", pod: "delivered",
  issue: "issue", exception: "issue", problem: "issue", hold: "issue", "on hold": "issue",
};

const MODE_MAP: Record<string, (typeof Constants.public.Enums.shipment_mode)[number]> = {
  ltl: "LTL", tradeshowltl: "LTL", "tradeshow ltl": "LTL",
  ftl: "FTL", tl: "FTL", truckload: "FTL", "full truckload": "FTL",
  tradeshowftl: "FTL", "tradeshow ftl": "FTL", "tradeshow truckload": "FTL",
  partial: "partial", "partial truckload": "partial", vptl: "partial",
  expedited: "expedited", hotshot: "expedited",
  specialized: "specialized", flatbed: "specialized",
};

const DEST_MAP: Record<string, (typeof Constants.public.Enums.shipment_destination)[number]> = {
  advance_warehouse: "advance_warehouse", "advance warehouse": "advance_warehouse", advance: "advance_warehouse", warehouse: "advance_warehouse",
  direct_to_show: "direct_to_show", "direct to show": "direct_to_show", direct: "direct_to_show", showsite: "direct_to_show",
};

const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};

/** Normalize a date to YYYY-MM-DD. Accepts ISO or US "M/D/YYYY [time...]". */
function dateStr(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const datePart = s.split(/[ T]/)[0];
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return undefined;
}
const intVal = (v: unknown) => {
  if (v == null || v === "") return undefined;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
};
const numVal = (v: unknown) => {
  if (v == null || v === "") return undefined;
  const n = Number.parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const boolVal = (v: unknown) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "yes", "1", "y"].includes(v.trim().toLowerCase());
  return false;
};

function mapStatus(item: Record<string, unknown>): (typeof Constants.public.Enums.shipment_status)[number] | undefined {
  const raw = item.status;
  if (inEnum(raw, Constants.public.Enums.shipment_status)) return raw;
  if (typeof raw === "string") {
    const mapped = STATUS_MAP[raw.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  // Fall back to Hyperion's boolean flags (most specific first).
  if (boolVal(item.isDelivered)) return "delivered";
  if (boolVal(item.isIntransit)) return "in_transit";
  if (boolVal(item.isDispatched)) return "booked";
  return undefined;
}
function mapMode(v: unknown): (typeof Constants.public.Enums.shipment_mode)[number] | undefined {
  if (inEnum(v, Constants.public.Enums.shipment_mode)) return v;
  if (typeof v === "string") return MODE_MAP[v.trim().toLowerCase()];
  return undefined;
}
function mapDest(v: unknown): (typeof Constants.public.Enums.shipment_destination)[number] | undefined {
  if (inEnum(v, Constants.public.Enums.shipment_destination)) return v;
  if (typeof v === "string") return DEST_MAP[v.trim().toLowerCase()];
  return undefined;
}

/** Best-effort parse of "street, city, ST zip" into origin parts. */
function parseLocation(v: unknown): {
  origin_street?: string;
  origin_city?: string;
  origin_state?: string;
  origin_zip?: string;
} {
  const s = str(v);
  if (!s) return {};
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  const out: ReturnType<typeof parseLocation> = {};
  const last = parts[parts.length - 1];
  const m = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) {
    out.origin_state = m[1].toUpperCase();
    out.origin_zip = m[2];
  } else {
    const z = last.match(/(\d{5}(?:-\d{4})?)/);
    if (z) out.origin_zip = z[1];
  }
  if (parts.length >= 2) out.origin_city = parts[parts.length - 2];
  if (parts.length >= 3) out.origin_street = parts.slice(0, parts.length - 2).join(", ");
  else if (parts.length === 1 && !m) out.origin_street = parts[0];
  return out;
}

/** Extract the load number (Hyperion clientLoadId), with common aliases. */
export function extractLoadNumber(item: Record<string, unknown>): string | undefined {
  return str(
    item.tms_reference_id ?? item.load_number ?? item.clientLoadId ?? item.clientloadid ??
      item.loadNumber ?? item.load_id ?? item.loadId ?? item.load,
  );
}

export type ParsedLoad = {
  ref: string;
  carrierName?: string;
  customerName?: string;
  fields: Partial<TablesInsert<"shipments">>;
};

/** Parse one payload item (Hyperion or generic). Null if no load number. */
export function parseLoad(item: Record<string, unknown>): ParsedLoad | null {
  const ref = extractLoadNumber(item);
  if (!ref) return null;

  const fields: Partial<TablesInsert<"shipments">> = {};
  const set = <K extends keyof TablesInsert<"shipments">>(k: K, v: TablesInsert<"shipments">[K] | undefined) => {
    if (v !== undefined) fields[k] = v;
  };

  set("status", mapStatus(item));
  set("mode", mapMode(item.mode ?? item.serviceType));
  set("destination_type", mapDest(item.destination_type ?? item.destination));
  set("pro_number", str(item.pro_number ?? item.proNumber ?? item.pro ?? item.tracking_number));
  set("pickup_date", dateStr(item.pickup_date ?? item.pickupDate ?? item.pickup));
  set("estimated_delivery_date", dateStr(item.estimated_delivery_date ?? item.deliveryDate ?? item.eta));
  set("actual_delivery_date", dateStr(item.actual_delivery_date ?? item.delivered_date ?? item.deliverStatusDate));
  set("pieces", intVal(item.pieces ?? item.totalPieces ?? item.piece_count));
  set("weight", numVal(item.weight ?? item.totalWeight ?? item.weight_lbs));
  set("package_type", str(item.package_type ?? item.packaging ?? item.packageType));
  set("tracking_url", str(item.tracking_url ?? item.carrierTrackingURL ?? item.carrier_tracking_url));
  set("destination_address", str(item.destination_address ?? item.delivery_location ?? item.deliveryLocation));

  // Origin: explicit fields win; otherwise parse pickupLocation.
  const loc = parseLocation(item.pickup_location ?? item.pickupLocation);
  set("origin_street", str(item.origin_street) ?? loc.origin_street);
  set("origin_city", str(item.origin_city) ?? loc.origin_city);
  set("origin_state", str(item.origin_state) ?? loc.origin_state);
  set("origin_zip", str(item.origin_zip ?? item.origin_postal_code) ?? loc.origin_zip);

  // Operator-owned free-text fields: only set if the payload explicitly carries
  // them, so syncs never clobber notes a coordinator typed.
  set("special_requirements", str(item.special_requirements));
  set("notes", str(item.notes));

  return {
    ref,
    carrierName: str(item.carrier_name ?? item.carrierName),
    customerName: str(item.customer_name ?? item.customerName ?? item.customerCompany),
    fields,
  };
}
