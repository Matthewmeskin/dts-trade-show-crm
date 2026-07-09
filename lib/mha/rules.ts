/**
 * MHA rule engine — the part that DECIDES.
 *
 * Pure functions over a transcription (MhaExtraction) and, when the load
 * resolves, the booked shipment (MhaLoad). No I/O, no model calls, no knowledge
 * of who submitted the form. Every failure traces to a named, testable rule.
 *
 * The two non-negotiables:
 *   R1  the carrier must NOT be DTS  (DTS is a broker; the GC releases freight
 *       only to the named motor carrier)
 *   R2  Bill Freight Charges To must BE DTS  (so the freight invoice reaches us)
 */
import type { MhaExtraction } from "./extraction";
import { isDts, matchDts, looksLikeDtsAddress } from "./dts-identity";
import { carriersMatch } from "./carrier-alias";

export type CheckSeverity = "fail" | "warn" | "info";

export type CheckResult = {
  code: string;
  severity: CheckSeverity;
  title: string; // plain language: what's wrong
  detail: string; // plain language: what to do about it
  found: string | null;
  expected: string | null;
};

export type Overall = "passed" | "warning" | "failed";

export const ACCESSORIAL_KEYS = [
  "liftgate",
  "inside_delivery",
  "residential",
  "pallet_jack",
  "call_before_delivery",
] as const;

export type AccessorialKey = (typeof ACCESSORIAL_KEYS)[number];

export const ACCESSORIAL_LABELS: Record<AccessorialKey, string> = {
  liftgate: "Liftgate",
  inside_delivery: "Inside delivery",
  residential: "Residential delivery",
  pallet_jack: "Pallet jack",
  call_before_delivery: "Call before delivery",
};

/** The booked load, reduced to what the load-aware rules compare against. */
export type MhaLoad = {
  id: string;
  reference: string | null; // the load number we matched on, for display
  carrierName: string | null;
  pieces: number | null;
  weight: number | null;
  consigneeZip: string | null;
  boothNumber: string | null;
  bookedAccessorials: Partial<Record<AccessorialKey, boolean>>;
};

function zip5(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/[^0-9]/g, "");
  return digits ? digits.slice(0, 5) : null;
}

function usedFieldIsLowConfidence(x: MhaExtraction): boolean {
  const keys = ["carrier.name", "bill_to.company", "bill_to.city", "bill_to.zip"];
  return keys.some((k) => x.confidence?.[k] === "low");
}

/**
 * Always-run rules (R1–R11) plus, when `load` is non-null, the load-aware rules
 * (L1–L7). Returns findings only; a clean field produces no CheckResult.
 */
export function evaluateRules(x: MhaExtraction, load: MhaLoad | null): CheckResult[] {
  const out: CheckResult[] = [];
  const carrierName = x.carrier?.name ?? null;
  const billToCompany = x.bill_to?.company ?? null;

  // ---- R1: carrier must not be DTS ----------------------------------------
  const carrierDts = matchDts(carrierName);
  if (carrierDts.matched) {
    out.push({
      code: "R1_CARRIER_IS_DTS",
      severity: "fail",
      title: "The carrier on this form is Diversified Transportation Services.",
      detail:
        "DTS arranges the freight but is not the trucking company that shows up at the dock. " +
        "The general contractor will only release your freight to the actual carrier named here. " +
        "Ask the service desk to put the real carrier (the trucking company DTS booked) in the Carrier box before you leave the booth.",
      found: carrierName,
      expected: "The trucking company DTS booked (not DTS itself)",
    });
  }

  // ---- R2: bill-to must be DTS --------------------------------------------
  // The company name OR the DTS billing address confirms it. Bill To is very
  // often hand-corrected — the printed exhibitor name struck through and "DTS"
  // + the Hamilton Ave address written in — so a matching DTS address is itself
  // a pass, even when the name box still shows (crossed-out) exhibitor text.
  if (!isDts(billToCompany)) {
    const addressMatches = looksLikeDtsAddress(
      x.bill_to?.street,
      x.bill_to?.city,
      x.bill_to?.state,
      x.bill_to?.zip,
    );
    if (!addressMatches) {
      out.push({
        code: "R2_BILL_TO_NOT_DTS",
        severity: "fail",
        title: "The Bill To section does not list Diversified Transportation Services.",
        detail:
          `The Bill To box reads ${billToCompany ? `"${billToCompany}"` : "something other than DTS"}. ` +
          "It needs to list Diversified Transportation Services (or the DTS billing address) so the freight " +
          "invoice comes to us instead of you. Ask the service desk for a corrected MHA before you leave the booth.",
        found: billToCompany,
        expected: "Diversified Transportation Services",
      });
    }
    // else: billed to the DTS address (typically a handwritten correction) — correct, no finding.
  }

  // ---- R3: carrier missing -------------------------------------------------
  if (!carrierName || !carrierName.trim()) {
    out.push({
      code: "R3_CARRIER_MISSING",
      severity: "fail",
      title: "No carrier is listed on the form.",
      detail:
        "The Carrier box is blank. Without a named carrier the general contractor decides where your freight goes. " +
        "Write in the trucking company DTS booked before you turn the form in.",
      found: null,
      expected: "The trucking company DTS booked",
    });
  }

  // ---- R4: GES 'Ship Via: GES Logistics' selected --------------------------
  if (x.gc_detected === "ges" && x.carrier?.gc_logistics_selected === true) {
    out.push({
      code: "R4_GC_LOGISTICS_SELECTED",
      severity: "fail",
      title: "This form is set to ship via GES Logistics.",
      detail:
        "The 'GES Logistics' option routes your freight to GES's own carrier, not the carrier DTS booked. " +
        "Select 'Other Carrier' and write in the DTS carrier instead.",
      found: "GES Logistics selected",
      expected: "Other Carrier (the DTS carrier)",
    });
  }

  // NOTE: the "RE-ROUTE VIA" line is pre-printed contract boilerplate that
  // exhibitors correctly leave blank (confirmed against a real, perfect Freeman
  // MHA), so we do NOT flag reroute state. It is transcribed for reference only.

  // ---- R7: piece / weight totals don't add up ------------------------------
  if (x.commodities.length > 0) {
    const piecesSum = x.commodities.reduce((n, c) => n + (c.pieces ?? 0), 0);
    const weightSum = x.commodities.reduce((n, c) => n + (c.weight_lbs ?? 0), 0);
    const piecesOff = x.total_pieces != null && piecesSum > 0 && piecesSum !== x.total_pieces;
    const weightOff = x.total_weight_lbs != null && weightSum > 0 && weightSum !== x.total_weight_lbs;
    if (piecesOff || weightOff) {
      out.push({
        // Informational only: the service desk verifies piece/weight at turn-in,
        // so a discrepancy here isn't something the exhibitor must pre-fix.
        code: "R7_TOTALS_MISMATCH",
        severity: "info",
        title: "The line items don't quite add up to the totals.",
        detail:
          "The service desk will confirm the actual piece count and weight when you turn the form in — just double-check them.",
        found: `lines: ${piecesSum} pcs / ${weightSum} lbs`,
        expected: `totals: ${x.total_pieces ?? "?"} pcs / ${x.total_weight_lbs ?? "?"} lbs`,
      });
    }
  }

  // ---- R8: no exhibitor signature -----------------------------------------
  if (x.exhibitor_signature_present === false) {
    out.push({
      code: "R8_NO_SIGNATURE",
      severity: "warn",
      title: "The form doesn't appear to be signed.",
      detail: "An unsigned MHA may not be accepted at the service desk. Make sure it's signed before turn-in.",
      found: "No signature detected",
      expected: "Signed by the exhibitor",
    });
  }

  // NOTE: Collect vs. Prepaid is NOT a defect. As long as Bill To is DTS, a form
  // with Collect (or with neither box checked, which Freeman treats as Collect)
  // is correct — so freight terms are transcribed for reference only, not checked.

  // ---- R10: a field the rules depend on is low confidence -------------------
  if (usedFieldIsLowConfidence(x)) {
    out.push({
      code: "R10_LOW_CONFIDENCE",
      severity: "warn",
      title: "Some key text was hard to read.",
      detail:
        "We weren't fully confident reading the Carrier or Bill To fields. Retake the photo in better light, straight-on and in focus, and submit again.",
      found: null,
      expected: null,
    });
  }

  // ---- R11: multiple destinations in the booth -----------------------------
  if (x.separate_destinations_in_booth != null && x.separate_destinations_in_booth > 1) {
    out.push({
      code: "R11_MULTI_DESTINATION",
      severity: "info",
      title: `This booth has ${x.separate_destinations_in_booth} separate destinations.`,
      detail:
        "Multiple destinations can change material-handling billing and may require more than one MHA. Flagging for a human to confirm.",
      found: String(x.separate_destinations_in_booth),
      expected: null,
    });
  }

  if (load) out.push(...evaluateLoadRules(x, load));
  return out;
}

function evaluateLoadRules(x: MhaExtraction, load: MhaLoad): CheckResult[] {
  const out: CheckResult[] = [];
  const carrierName = x.carrier?.name ?? null;

  // ---- L1: carrier on MHA vs booked carrier -------------------------------
  if (carrierName && load.carrierName && !carriersMatch(carrierName, load.carrierName)) {
    out.push({
      code: "L1_CARRIER_MISMATCH",
      severity: "warn",
      title: "The carrier on the MHA doesn't match the carrier we booked.",
      detail:
        "The trucking company written on the form differs from the one on the load. " +
        "Confirm the MHA lists the carrier DTS actually dispatched.",
      found: carrierName,
      expected: load.carrierName,
    });
  }

  // ---- L2: pieces vs booked -----------------------------------------------
  if (x.total_pieces != null && load.pieces != null && x.total_pieces !== load.pieces) {
    out.push({
      code: "L2_PIECES_MISMATCH",
      severity: "warn",
      title: "The piece count doesn't match the booked load.",
      detail: "Confirm the actual count at the show against what was booked; a difference can affect billing and space.",
      found: `${x.total_pieces} pcs`,
      expected: `${load.pieces} pcs`,
    });
  }

  // ---- L3: weight vs booked (tolerant) ------------------------------------
  if (x.total_weight_lbs != null && load.weight != null) {
    const tolerance = Math.max(100, load.weight * 0.1);
    if (Math.abs(x.total_weight_lbs - load.weight) > tolerance) {
      out.push({
        code: "L3_WEIGHT_MISMATCH",
        severity: "warn",
        title: "The weight is well off the booked weight.",
        detail: "Show-floor weights are estimates, but this gap is large enough to confirm before the freight moves.",
        found: `${x.total_weight_lbs} lbs`,
        expected: `${load.weight} lbs (±${Math.round(tolerance)})`,
      });
    }
  }

  // ---- L4: destination zip vs booked consignee ----------------------------
  {
    const mhaZip = zip5(x.destination?.zip);
    const bookedZip = zip5(load.consigneeZip);
    if (mhaZip && bookedZip && mhaZip !== bookedZip) {
      out.push({
        code: "L4_DESTINATION_MISMATCH",
        severity: "warn",
        title: "The destination ZIP doesn't match the booked consignee.",
        detail: "Confirm the delivery address on the MHA matches where the load is booked to deliver.",
        found: mhaZip,
        expected: bookedZip,
      });
    }
  }

  // ---- L5: accessorial on MHA but NOT booked (the rebill trap) -------------
  const notBooked = ACCESSORIAL_KEYS.filter(
    (k) => x.accessorials?.[k] === true && load.bookedAccessorials[k] !== true,
  );
  if (notBooked.length > 0) {
    const labels = notBooked.map((k) => ACCESSORIAL_LABELS[k]).join(", ");
    out.push({
      code: "L5_ACCESSORIAL_NOT_BOOKED",
      severity: "warn",
      title: `Accessorial on the MHA that wasn't quoted: ${labels}.`,
      detail:
        "If the carrier performs a service that wasn't quoted, they bill DTS for it after delivery. " +
        "Confirm the service is needed and get it added to the booking so it isn't a surprise rebill.",
      found: labels,
      expected: "Only booked accessorials",
    });
  }

  // ---- L6: booked accessorial NOT on the MHA ------------------------------
  const missingOnMha = ACCESSORIAL_KEYS.filter(
    (k) => load.bookedAccessorials[k] === true && x.accessorials?.[k] !== true,
  );
  if (missingOnMha.length > 0) {
    const labels = missingOnMha.map((k) => ACCESSORIAL_LABELS[k]).join(", ");
    out.push({
      code: "L6_ACCESSORIAL_BOOKED_NOT_ON_MHA",
      severity: "info",
      title: `Booked accessorial not shown on the MHA: ${labels}.`,
      detail: "We booked this service but it isn't marked on the form. Usually harmless, but worth a glance.",
      found: "Not on MHA",
      expected: labels,
    });
  }

  // ---- L7: booth mismatch --------------------------------------------------
  if (
    x.booth_number &&
    load.boothNumber &&
    x.booth_number.trim().toLowerCase() !== load.boothNumber.trim().toLowerCase()
  ) {
    out.push({
      code: "L7_BOOTH_MISMATCH",
      severity: "info",
      title: "The booth number differs from the booked load.",
      detail: "Minor, but confirm the booth so the paperwork and the load line up.",
      found: x.booth_number,
      expected: load.boothNumber,
    });
  }

  return out;
}

/** any fail → failed; else any warn → warning; else passed (info is neutral). */
export function overallStatus(results: CheckResult[]): Overall {
  if (results.some((r) => r.severity === "fail")) return "failed";
  if (results.some((r) => r.severity === "warn")) return "warning";
  return "passed";
}
