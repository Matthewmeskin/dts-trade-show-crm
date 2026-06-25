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

/** Best-effort parse of "street, city, ST zip" into parts. */
function parseAddressParts(v: unknown): {
  street1?: string;
  city?: string;
  state?: string;
  zip?: string;
} {
  const s = str(v);
  if (!s) return {};
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  const out: ReturnType<typeof parseAddressParts> = {};
  const last = parts[parts.length - 1];
  const m = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) {
    out.state = m[1].toUpperCase();
    out.zip = m[2];
  } else {
    const z = last.match(/(\d{5}(?:-\d{4})?)/);
    if (z) out.zip = z[1];
  }
  if (parts.length >= 2) out.city = parts[parts.length - 2];
  if (parts.length >= 3) out.street1 = parts.slice(0, parts.length - 2).join(", ");
  else if (parts.length === 1 && !m) out.street1 = parts[0];
  return out;
}

/** Origin parse (keeps the origin_* shape the caller expects). */
function parseLocation(v: unknown): {
  origin_street?: string;
  origin_city?: string;
  origin_state?: string;
  origin_zip?: string;
} {
  const p = parseAddressParts(v);
  return {
    origin_street: p.street1,
    origin_city: p.city,
    origin_state: p.state,
    origin_zip: p.zip,
  };
}

type Stop = Record<string, unknown>;

/** Structured fields from one Hyperion stop object. */
function stopAddress(stop: Stop | undefined) {
  if (!stop) return undefined;
  return {
    company: str(stop.companyName ?? stop.company),
    contact: str(stop.contactName ?? stop.contact),
    phone: str(stop.contactPhone ?? stop.phone),
    street1: str(stop.address1 ?? stop.addressLine),
    street2: str(stop.address2 ?? stop.addressLine2),
    city: str(stop.city),
    state: str(stop.state),
    zip: str(stop.zip ?? stop.postalCode),
    country: str(stop.country),
    full: str(stop.fullAddress ?? stop.addressLine),
  };
}

function findStop(stops: Stop[], types: string[]): Stop | undefined {
  return stops.find((s) => types.includes(String(s.stopType ?? "").trim().toLowerCase()));
}

/** Pull a booth number out of free-text address ("… - Booth #3727, …"). */
function boothFrom(...texts: (string | undefined)[]): string | undefined {
  for (const t of texts) {
    if (!t) continue;
    // Require a digit in the token so stray words ("Booth #LAST …") don't match.
    const m = t.match(/booth\s*#?\s*([A-Za-z0-9-]*\d[A-Za-z0-9-]*)/i);
    if (m) return m[1];
  }
  return undefined;
}

/** Extract the load number (Hyperion clientLoadId), with common aliases. */
export function extractLoadNumber(item: Record<string, unknown>): string | undefined {
  return str(
    item.tms_reference_id ?? item.load_number ?? item.clientLoadId ?? item.clientloadid ??
      item.loadNumber ?? item.load_id ?? item.loadId ?? item.load,
  );
}

/** Extract the Hyperion customer number, with common aliases. */
export function extractCustomerId(item: Record<string, unknown>): string | undefined {
  return str(
    item.tms_customer_id ?? item.customerId ?? item.customer_id ?? item.customerNumber ??
      item.customerNo ?? item.customerNum ?? item.clientId ?? item.clientCustomerId ??
      item.billToId ?? item.billToCustomerId ?? item.customerCompanyId,
  );
}

/**
 * Hyperion shipment-profile deep link for a load: needs both the customer
 * number and the load number. Returns null if either is missing.
 */
export function hyperionShipmentUrl(
  customerId: string | null | undefined,
  loadNumber: string | null | undefined,
): string | null {
  const c = str(customerId);
  const l = str(loadNumber);
  if (!c || !l) return null;
  return `https://hyperion.dtsone.com/pages/shipments/shipmentprofile/${encodeURIComponent(c)}/${encodeURIComponent(l)}`;
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
  set("tms_customer_id", extractCustomerId(item));

  // Delivery / consignee (the move-out return party) + booth. Handles both the
  // structured Hyperion stops[] shape and the flat *Location string shape.
  const stops: Stop[] = Array.isArray(item.stops) ? (item.stops as Stop[]) : [];
  const drop = stopAddress(findStop(stops, ["drop", "delivery", "consignee"]));
  const pickup = stopAddress(findStop(stops, ["pickup", "pick", "origin"]));
  const deliveryStr =
    drop?.full ?? str(item.destination_address ?? item.delivery_location ?? item.deliveryLocation);
  const pickupStr = pickup?.full ?? str(item.pickup_location ?? item.pickupLocation);
  const da = parseAddressParts(deliveryStr);

  set("destination_address", str(item.destination_address) ?? deliveryStr);
  set("consignee_company", drop?.company);
  set("consignee_contact", drop?.contact);
  set("consignee_phone", drop?.phone);
  set("consignee_street1", drop?.street1 ?? da.street1);
  set("consignee_street2", drop?.street2);
  set("consignee_city", drop?.city ?? da.city);
  set("consignee_state", drop?.state ?? da.state);
  set("consignee_zip", drop?.zip ?? da.zip);
  set("consignee_country", drop?.country);
  set("booth_number", boothFrom(pickupStr, deliveryStr));

  // Origin: explicit fields win; otherwise parse the pickup location.
  const loc = parseLocation(item.pickup_location ?? item.pickupLocation ?? pickup?.full);
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
