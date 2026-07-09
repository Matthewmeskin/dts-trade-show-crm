/**
 * Presentation helpers derived from a transcription + its findings:
 *   - buildChecklist: the full list of verification points with pass/fail/na, so
 *     the result screen can show what was CHECKED, not just what went wrong.
 *   - buildRecommendations: proactive advice (best-practice reroute wording,
 *     and piece/weight values from our records when the form left them blank).
 *
 * Pure and free of server/React deps so both the API and the client can use it.
 */
import type { MhaExtraction } from "./extraction";
import type { CheckResult } from "./rules";

export type ChecklistStatus = "pass" | "fail" | "warn" | "na";
export type ChecklistItem = { label: string; status: ChecklistStatus; note?: string };

/** DTS's preferred carrier-no-show instruction for the RE-ROUTE VIA section. */
export const RETURN_TO_WAREHOUSE_TEXT =
  "Return shipment to warehouse (where available), assess all associated charges per Material Handling schedule";

export function buildChecklist(
  x: MhaExtraction,
  checks: CheckResult[],
  hasLoad: boolean,
): ChecklistItem[] {
  const has = (code: string) => checks.some((c) => c.code === code);
  const items: ChecklistItem[] = [];

  items.push({
    label: "Carrier is a real carrier (not DTS)",
    status: has("R1_CARRIER_IS_DTS") || has("R3_CARRIER_MISSING") ? "fail" : "pass",
    note: x.carrier?.name ?? undefined,
  });

  items.push({
    label: "Freight is billed to DTS",
    status: has("R2_BILL_TO_NOT_DTS") ? "fail" : "pass",
    note: x.bill_to?.company ?? undefined,
  });

  if (x.gc_detected === "ges") {
    items.push({
      label: "Not shipping via the GC's own carrier",
      status: has("R4_GC_LOGISTICS_SELECTED") ? "fail" : "pass",
    });
  }

  items.push({
    label: "Signed by the exhibitor",
    status:
      x.exhibitor_signature_present == null ? "na" : has("R8_NO_SIGNATURE") ? "warn" : "pass",
  });

  const noTotals =
    x.commodities.length === 0 || (x.total_pieces == null && x.total_weight_lbs == null);
  items.push({
    label: "Piece & weight totals add up",
    status: noTotals ? "na" : has("R7_TOTALS_MISMATCH") ? "warn" : "pass",
  });

  if (hasLoad) {
    items.push({
      label: "Carrier matches the booking",
      status: has("L1_CARRIER_MISMATCH") ? "warn" : "pass",
    });
    items.push({
      label: "Pieces match the booking",
      status: has("L2_PIECES_MISMATCH") ? "warn" : "pass",
    });
    items.push({
      label: "Weight matches the booking",
      status: has("L3_WEIGHT_MISMATCH") ? "warn" : "pass",
    });
    items.push({
      label: "Destination matches the booking",
      status: has("L4_DESTINATION_MISMATCH") ? "warn" : "pass",
    });
    items.push({
      label: "Accessorials match the booking",
      status: has("L5_ACCESSORIAL_NOT_BOOKED") ? "warn" : "pass",
    });
  }

  return items;
}

export type Recommendation = { title: string; detail: string; copy?: string };

/** Booked figures we can offer back to the exhibitor when the form is blank. */
export type BookedFigures = { pieces: number | null; weight: number | null } | null;

export function buildRecommendations(x: MhaExtraction, booked: BookedFigures): Recommendation[] {
  const recs: Recommendation[] = [];

  if (x.carrier_no_show_option !== "return_to_warehouse") {
    recs.push({
      title: "Add a carrier no-show instruction",
      detail:
        'In the "RE-ROUTE VIA" / carrier-fails-to-show area, write the line below. It keeps the freight ' +
        "under DTS's control (returned to the warehouse) instead of the general contractor rerouting it.",
      copy: RETURN_TO_WAREHOUSE_TEXT,
    });
  }

  if (booked) {
    const needPieces = x.total_pieces == null && booked.pieces != null;
    const needWeight = x.total_weight_lbs == null && booked.weight != null;
    if (needPieces || needWeight) {
      const parts: string[] = [];
      if (booked.pieces != null) parts.push(`${booked.pieces} pieces`);
      if (booked.weight != null) parts.push(`${booked.weight} lbs`);
      recs.push({
        title: "Fill in the piece count and weight",
        detail:
          `The service desk will ask for these. From our records for this load: ${parts.join(" / ")}. ` +
          "Confirm against the actual freight, then write it on the form.",
      });
    }
  }

  return recs;
}
