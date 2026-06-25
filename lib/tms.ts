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
/** Normalize a timestamp (ISO or US date) to an ISO string; undefined if unparseable. */
function tsStr(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const day = dateStr(s);
  return day ? new Date(`${day}T00:00:00Z`).toISOString() : undefined;
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

/**
 * Signals that a stop is the trade-show side (venue/booth), not an origin/return.
 * Named venues require enough words to avoid matching same-named streets (e.g.
 * "McCormick Dr" in Maryland is not Chicago's McCormick Place).
 */
const SHOW_VENUE_RE =
  /\bbooth\b|\bconv\b|\bconvention\b|\bexpo\b|exhibit|fairground|pavilion|civic center|trade ?show|mccormick place|javits|mandalay bay|moscone|sands expo|caesars forum|conv(?:ention)? ctr|conv(?:ention)? center/i;

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
  /** Inferred move-in/move-out — applied by the ingest only when not already set. */
  direction?: (typeof Constants.public.Enums.shipment_direction)[number];
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
  set("mode", mapMode(item.mode ?? item.serviceType ?? item.shipmentMode));
  set("destination_type", mapDest(item.destination_type ?? item.destination));
  set("pickup_date", dateStr(item.pickup_date ?? item.pickupDate ?? item.pickup));
  set("estimated_delivery_date", dateStr(item.estimated_delivery_date ?? item.deliveryDate ?? item.eta));
  set("actual_delivery_date", dateStr(item.actual_delivery_date ?? item.delivered_date ?? item.deliverStatusDate));
  set("tracking_url", str(item.tracking_url ?? item.carrierTrackingURL ?? item.carrier_tracking_url));
  set("tms_customer_id", extractCustomerId(item));
  // When the load/quote was created in the TMS (Hyperion `createdate`) — shown
  // as the "Quoted" date. Left null when the source doesn't provide it.
  set("tms_created_at", tsStr(item.tms_created_at ?? item.createdate ?? item.createDate ?? item.created_date ?? item.dateCreated));

  // Hyperion carries handling units, money, and the carrier as arrays/nested
  // fields; aggregate them. Flat payloads (hand-built or the tracking feed)
  // still set the top-level fields directly via the ?? fallbacks.
  const lineItems: Record<string, unknown>[] = Array.isArray(item.items)
    ? (item.items as Record<string, unknown>[])
    : [];
  const accessorials: Record<string, unknown>[] = Array.isArray(item.accessorials)
    ? (item.accessorials as Record<string, unknown>[])
    : [];
  const carriers: Record<string, unknown>[] = Array.isArray(item.carriers)
    ? (item.carriers as Record<string, unknown>[])
    : [];
  const primaryCarrier = carriers.find((c) => boolVal(c.isPrimary)) ?? carriers[0];

  /** Sum a numeric field across rows (first matching key per row); undefined if none present. */
  const sumField = (rows: Record<string, unknown>[], keys: string[]): number | undefined => {
    let total = 0;
    let seen = false;
    for (const r of rows) {
      for (const k of keys) {
        if (r[k] != null && r[k] !== "") {
          const n = numVal(r[k]);
          if (n != null) {
            total += n;
            seen = true;
          }
          break;
        }
      }
    }
    return seen ? total : undefined;
  };
  const addParts = (...parts: (number | undefined)[]) => {
    const present = parts.filter((n): n is number => n != null);
    return present.length ? present.reduce((a, b) => a + b, 0) : undefined;
  };
  const round2 = (n: number) => Math.round(n * 100) / 100;

  set("pieces", intVal(item.pieces ?? item.totalPieces ?? item.piece_count) ?? (
    lineItems.length ? lineItems.reduce((a, r) => a + (intVal(r.pieces ?? r.handlingUnits) ?? 0), 0) || undefined : undefined
  ));
  set("weight", numVal(item.weight ?? item.totalWeight ?? item.weight_lbs) ?? sumField(lineItems, ["weight"]));
  set("package_type", str(item.package_type ?? item.packaging ?? item.packageType ?? primaryCarrier?.packaging ?? lineItems[0]?.packaging));

  const billed =
    numVal(item.billed_amount ?? item.billed ?? item.customer_total ?? item.totalBilled) ??
    addParts(sumField(lineItems, ["billed"]), sumField(accessorials, ["bill", "billed"]));
  const cost =
    numVal(item.cost_amount ?? item.cost ?? item.carrier_total ?? item.totalCost) ??
    addParts(sumField(lineItems, ["cost"]), sumField(accessorials, ["cost"]));
  // margin is a generated column (billed − cost) — set the two inputs and let
  // the DB compute it.
  set("billed_amount", billed != null ? round2(billed) : undefined);
  set("cost_amount", cost != null ? round2(cost) : undefined);

  // Reference numbers: customer PO and shipper number, plus a carrier PRO
  // fallback (Hyperion puts the PRO on the primary carrier).
  set("po_ref", str(item.po_ref ?? item.poReference ?? item.poNumber ?? item.po ?? item.purchaseOrder ?? item.poRef));
  set("shipper_number", str(item.shipper_number ?? item.shipperNum ?? item.shipperNumber));
  set("pro_number", str(
    item.pro_number ?? item.proNumber ?? item.pro ?? item.tracking_number ??
      primaryCarrier?.carrierProNumber ?? primaryCarrier?.proNumber,
  ));

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

  // Trade-show venue context: the show-side stop (the one with the booth or a
  // convention-venue keyword). Raw text is messy on purpose — it's the input
  // for fuzzy matching + AI venue/show discovery.
  const venueCandidates: { full?: string; city?: string; state?: string }[] = [
    pickup ? { full: pickup.full, city: pickup.city, state: pickup.state } : { full: pickupStr },
    drop ? { full: drop.full, city: drop.city, state: drop.state } : { full: deliveryStr },
  ];
  const showSideIdx = venueCandidates.findIndex((c) => c.full && SHOW_VENUE_RE.test(c.full));
  const showSide = showSideIdx >= 0 ? venueCandidates[showSideIdx] : undefined;
  if (showSide?.full) {
    const parts = parseAddressParts(showSide.full);
    set("tms_venue_raw", showSide.full);
    set("tms_venue_city", showSide.city ?? parts.city);
    set("tms_venue_state", showSide.state ?? parts.state);
  }
  // Infer direction from which end is the show: show on the delivery side means
  // freight headed INTO the show (move-in); show on the pickup side means
  // freight coming back FROM it (move-out). Index 0 = pickup, 1 = delivery.
  const direction: (typeof Constants.public.Enums.shipment_direction)[number] | undefined =
    showSideIdx === 1 ? "move_in" : showSideIdx === 0 ? "move_out" : undefined;

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
    carrierName: str(
      item.carrier_name ?? item.carrierName ?? primaryCarrier?.carrierName ?? primaryCarrier?.carrier_name,
    ),
    customerName: str(item.customer_name ?? item.customerName ?? item.customerCompany),
    direction,
    fields,
  };
}
