import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteRef, quoteRefText } from "../quote-ref";
import { normalizeLoadNumber } from "../mha/match-load";

// The number printed on the outbound form has to be a number MHA lookup can find
// again. These tests hold the two ends together: the priority order here must be
// the priority order match-load.ts searches.

test("prefers the TMS reference, which every shipment has", () => {
  const r = quoteRef({
    tms_reference_id: "100139",
    pro_number: "987654321",
    status: "booked",
  });
  assert.equal(r?.value, "100139");
  assert.equal(r?.source, "tms_reference_id");
});

test("a quote is labelled Quote #, the same number after booking is DTS #", () => {
  assert.equal(quoteRef({ tms_reference_id: "100139", status: "quoted" })?.label, "Quote #");
  assert.equal(quoteRef({ tms_reference_id: "100139", status: "booked" })?.label, "DTS #");
  assert.equal(quoteRef({ tms_reference_id: "100139", status: "delivered" })?.label, "DTS #");
});

test("falls down the same priority order match-load uses", () => {
  assert.equal(quoteRef({ pro_number: "987654321" })?.label, "PRO #");
  assert.equal(quoteRef({ shipper_number: "SH-1" })?.source, "shipper_number");
  assert.equal(quoteRef({ po_ref: "PO-9" })?.source, "po_ref");
  assert.equal(quoteRef({ check_in_number: "CI-3" })?.source, "check_in_number");
});

test("a shipment with no references at all prints nothing rather than a blank label", () => {
  assert.equal(quoteRef({}), null);
  assert.equal(quoteRef({ tms_reference_id: null, pro_number: null }), null);
  assert.equal(quoteRefText({}), null);
});

test("whitespace-only references do not count as a number", () => {
  // A TMS sync that writes "" or " " must not put an empty box on a printed form.
  assert.equal(quoteRef({ tms_reference_id: "   " }), null);
  assert.equal(quoteRef({ tms_reference_id: "  ", pro_number: "987654321" })?.source, "pro_number");
});

test("the printed value trims but is otherwise untouched", () => {
  // Never reformatted: the customer has to be able to match it character for
  // character against what the TMS and the MHA show.
  assert.equal(quoteRef({ tms_reference_id: " 100139 " })?.value, "100139");
  assert.equal(quoteRef({ tms_reference_id: "0100139" })?.value, "0100139");
});

test("what we print normalizes to what the lookup searches", () => {
  // The guarantee that matters: an exhibitor reading the number off the form and
  // typing it back in gets a hit, including the leading-zero case.
  for (const stored of ["100139", "0100139", " 100139 "]) {
    const printed = quoteRef({ tms_reference_id: stored })!.value;
    assert.equal(normalizeLoadNumber(printed), normalizeLoadNumber(stored));
  }
});

test("quoteRefText reads the way someone would say it out loud", () => {
  assert.equal(quoteRefText({ tms_reference_id: "100139", status: "quoted" }), "Quote # 100139");
});
