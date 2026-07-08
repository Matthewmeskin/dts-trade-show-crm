/**
 * Resolve the load number an exhibitor typed to a booked shipment.
 *
 * There is no single "load number" column on `shipments`; the references a
 * customer might quote are tms_reference_id (primary), pro_number,
 * shipper_number, po_ref and check_in_number. We normalize both sides and match
 * exactly. A wrong match is worse than no match — it invents false mismatch
 * warnings and destroys trust — so we never guess.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { MhaLoad, AccessorialKey } from "./rules";

export type MatchMethod = "exact" | "fuzzy" | "none";

export type LoadMatch = {
  load: MhaLoad | null;
  loadId: string | null;
  matchMethod: MatchMethod;
};

/** The shipment columns, in priority order, that a customer might quote. */
const REFERENCE_COLUMNS = [
  "tms_reference_id",
  "pro_number",
  "shipper_number",
  "po_ref",
  "check_in_number",
] as const;

/** Uppercase, strip whitespace and punctuation, drop leading zeros. */
export function normalizeLoadNumber(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.replace(/^0+/, "") || cleaned;
}

/** Derive booked accessorials from the free-text special_requirements field. */
export function parseBookedAccessorials(
  text: string | null | undefined,
): Partial<Record<AccessorialKey, boolean>> {
  const out: Partial<Record<AccessorialKey, boolean>> = {};
  if (!text) return out;
  const t = text.toLowerCase();
  if (/lift\s*gate|liftgate/.test(t)) out.liftgate = true;
  if (/inside\s*(delivery|del)?/.test(t)) out.inside_delivery = true;
  if (/residential|resi\b/.test(t)) out.residential = true;
  if (/pallet\s*jack/.test(t)) out.pallet_jack = true;
  if (/call\s*before|call\s*ahead|notify\s*before/.test(t)) out.call_before_delivery = true;
  return out;
}

type ShipmentRow = {
  id: string;
  tms_reference_id: string | null;
  pro_number: string | null;
  shipper_number: string | null;
  po_ref: string | null;
  check_in_number: string | null;
  pieces: number | null;
  weight: number | null;
  consignee_zip: string | null;
  booth_number: string | null;
  special_requirements: string | null;
  carrier: { carrier_name: string | null } | null;
};

const SELECT =
  "id, tms_reference_id, pro_number, shipper_number, po_ref, check_in_number, pieces, weight, consignee_zip, booth_number, special_requirements, carrier:carriers(carrier_name)";

function toMhaLoad(row: ShipmentRow, matchedRef: string | null): MhaLoad {
  return {
    id: row.id,
    reference: matchedRef,
    carrierName: row.carrier?.carrier_name ?? null,
    pieces: row.pieces,
    weight: row.weight,
    consigneeZip: row.consignee_zip,
    boothNumber: row.booth_number,
    bookedAccessorials: parseBookedAccessorials(row.special_requirements),
  };
}

/**
 * Look up the load. Blank input short-circuits to `none` (the user is allowed
 * to submit without a load number). We fetch a slim projection and compare
 * normalized values in JS so leading zeros and punctuation never cause a miss.
 * The candidate set is small (hundreds of rows) and this runs once per submit.
 */
export async function matchLoad(
  supabase: SupabaseClient<Database>,
  rawInput: string | null | undefined,
): Promise<LoadMatch> {
  const norm = normalizeLoadNumber(rawInput);
  if (!norm) return { load: null, loadId: null, matchMethod: "none" };

  const { data, error } = await supabase.from("shipments").select(SELECT);
  if (error || !data) return { load: null, loadId: null, matchMethod: "none" };

  const rows = data as unknown as ShipmentRow[];
  for (const col of REFERENCE_COLUMNS) {
    const hit = rows.find((r) => normalizeLoadNumber(r[col]) === norm && normalizeLoadNumber(r[col]) !== "");
    if (hit) {
      return { load: toMhaLoad(hit, hit[col]), loadId: hit.id, matchMethod: "exact" };
    }
  }

  return { load: null, loadId: null, matchMethod: "none" };
}
