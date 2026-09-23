import { REFERENCE_COLUMNS } from "@/lib/mha/match-load";

/**
 * The number DTS gives a customer for a shipment, and the label to call it.
 *
 * There is no `quote_number` column, deliberately. `tms_reference_id` is already
 * on 100% of shipments - every quote, every booked load - and `match-load.ts`
 * already looks up whatever an exhibitor types against the same list of
 * references. Adding a second column to hold the same number would give one
 * shipment two answers to "what is my quote number", and only one of them would
 * be the one MHA lookup finds.
 *
 * So this picks from the columns that already exist, in the same priority order
 * the lookup uses, and that guarantees the number we print is a number we can
 * find again.
 */

export type ReferenceSource = (typeof REFERENCE_COLUMNS)[number];

export type ShipmentReferences = Partial<
  Record<ReferenceSource, string | null>
> & {
  status?: string | null;
};

/** How to label each reference on screen and on the printed form. */
const LABELS: Record<ReferenceSource, string> = {
  tms_reference_id: "DTS #",
  pro_number: "PRO #",
  shipper_number: "Shipper #",
  po_ref: "PO #",
  check_in_number: "Check-in #",
};

export type QuoteRef = {
  /** The value to show. */
  value: string;
  /** Which column it came from. */
  source: ReferenceSource;
  /** "Quote #" while it is still a quote, otherwise the reference's own name. */
  label: string;
};

/**
 * The reference to show for a shipment, or null when it has none.
 *
 * The label shifts with the shipment's status: the same number is the customer's
 * "Quote #" before they book and the "DTS #" after, and calling it the wrong
 * thing on a printed form is how you get a phone call.
 */
export function quoteRef(s: ShipmentReferences): QuoteRef | null {
  for (const source of REFERENCE_COLUMNS) {
    const raw = s[source];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    const label =
      source === "tms_reference_id" && s.status === "quoted"
        ? "Quote #"
        : LABELS[source];
    return { value, source, label };
  }
  return null;
}

/** "Quote # 100139", or null. For a subtitle or a PDF line. */
export function quoteRefText(s: ShipmentReferences): string | null {
  const r = quoteRef(s);
  return r ? `${r.label} ${r.value}` : null;
}

/** The select list any query needs to resolve a reference. */
export const QUOTE_REF_SELECT = [...REFERENCE_COLUMNS, "status"].join(", ");
