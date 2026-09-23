import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quoteRef, type ShipmentReferences } from "@/lib/quote-ref";

/**
 * The carrier quote number is deliberately NOT part of quote-ref.ts.
 *
 * quote-ref answers "what number does the exhibitor read back to us", and it is
 * constrained to the columns match-load.ts searches, so that anything we print
 * can be found again. The carrier's quote number is not one of those: MHA lookup
 * does not search it, and if it ever leaked into that list an exhibitor could
 * quote a number that resolves to nothing.
 *
 * These tests pin that separation, because the two fields are one word apart in
 * conversation and the failure is silent.
 */
describe("carrier quote number stays out of the exhibitor-facing reference", () => {
  test("a carrier quote number is never chosen as the exhibitor reference", () => {
    const s = {
      carrier_quote_number: "Q-99887766",
      tms_reference_id: "117374",
      status: "quoted",
    } as ShipmentReferences & { carrier_quote_number: string };

    const ref = quoteRef(s);
    assert.equal(ref?.value, "117374");
    assert.equal(ref?.source, "tms_reference_id");
    assert.equal(ref?.label, "Quote #");
  });

  test("with no DTS reference at all, a carrier quote number does not stand in", () => {
    const s = { carrier_quote_number: "Q-99887766" } as ShipmentReferences & {
      carrier_quote_number: string;
    };
    assert.equal(quoteRef(s), null);
  });

  test("the same DTS number is Quote # while quoted and DTS # once it is not", () => {
    assert.equal(quoteRef({ tms_reference_id: "117374", status: "quoted" })?.label, "Quote #");
    assert.equal(quoteRef({ tms_reference_id: "117374", status: "booked" })?.label, "DTS #");
    assert.equal(quoteRef({ tms_reference_id: "117374", status: "delivered" })?.label, "DTS #");
  });
});
