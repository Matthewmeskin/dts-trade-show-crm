import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateRules, overallStatus, type MhaLoad } from "../rules";
import { MhaExtractionSchema, type MhaExtraction } from "../extraction";

/** A clean MHA: carrier is not DTS, bill-to IS DTS, nothing else amiss. */
function pass(): MhaExtraction {
  return MhaExtractionSchema.parse({
    gc_detected: "freeman",
    form_code: "FDC0097T",
    show_name: "Fabtech",
    booth_number: "A456",
    origin: { company: "LA Manufacturing", city: "Pasadena", state: "CA", zip: "91001" },
    destination: { city: "Chicago", state: "IL", zip: "60616" },
    carrier: { name: "T-Force Freight", phone: null, gc_logistics_selected: null },
    bill_to: {
      company: "Diversified Transportation Services",
      street: "19829 Hamilton Avenue",
      city: "Torrance",
      state: "CA",
      zip: "90502",
    },
    freight_terms: "prepaid",
    commodities: [{ description: "Skids", pieces: 3, weight_lbs: 1000 }],
    total_pieces: 3,
    total_weight_lbs: 1000,
    accessorials: {
      liftgate: true,
      inside_delivery: false,
      residential: false,
      pallet_jack: false,
      call_before_delivery: false,
      other_text: null,
    },
    service_level: null,
    separate_destinations_in_booth: 1,
    carrier_no_show_option: "return_to_warehouse",
    declared_value: null,
    exhibitor_signature_present: true,
    confidence: { "carrier.name": "high", "bill_to.company": "high" },
  });
}

const codes = (x: MhaExtraction, load: MhaLoad | null = null) =>
  evaluateRules(x, load).map((c) => c.code);

/** A booked load that matches the clean extraction. */
function bookedLoad(): MhaLoad {
  return {
    id: "load-1",
    reference: "L123",
    carrierName: "TForce Freight",
    pieces: 3,
    weight: 1000,
    consigneeZip: "60616",
    boothNumber: "A456",
    bookedAccessorials: { liftgate: true },
  };
}

// --------------------------- always-run rules ------------------------------

test("clean form produces no findings", () => {
  assert.deepEqual(codes(pass()), []);
});

test("R1: carrier is DTS -> fail", () => {
  const x = pass();
  x.carrier.name = "Diversified Transportation Services";
  const found = evaluateRules(x, null).find((c) => c.code === "R1_CARRIER_IS_DTS");
  assert.ok(found && found.severity === "fail");
});

test("R2: bill-to is not DTS (name and address) -> fail", () => {
  const x = pass();
  x.bill_to.company = "LA Manufacturing";
  x.bill_to.street = "123 Main Street";
  x.bill_to.city = "Pasadena";
  x.bill_to.state = "CA";
  x.bill_to.zip = "91001";
  const found = evaluateRules(x, null).find((c) => c.code === "R2_BILL_TO_NOT_DTS");
  assert.ok(found && found.severity === "fail");
});

test("R2: DTS billing address is a pass even when the name box isn't a clean DTS match", () => {
  // Hand-corrected bill-to: printed exhibitor name still shows, but the DTS
  // Hamilton Ave address is written in. Must NOT fail R2.
  const crossout = pass();
  crossout.bill_to.company = "Tiger-Vac Inc USA"; // struck-through printed name
  crossout.bill_to.street = "19829 Hamilton Ave";
  crossout.bill_to.city = "Torrance";
  crossout.bill_to.state = "CA";
  crossout.bill_to.zip = "90502";
  assert.ok(!codes(crossout).includes("R2_BILL_TO_NOT_DTS"));

  // Illegible/blank name + DTS address is also a pass.
  const blank = pass();
  blank.bill_to.company = null;
  assert.ok(!codes(blank).includes("R2_BILL_TO_NOT_DTS"));
});

test("R2: fails only when neither the name nor the address is DTS", () => {
  const x = pass();
  x.bill_to.company = "Tiger-Vac Inc USA";
  x.bill_to.street = "11 SW 12th Ave";
  x.bill_to.city = "Dania";
  x.bill_to.state = "FL";
  x.bill_to.zip = "33004";
  const found = evaluateRules(x, null).find((c) => c.code === "R2_BILL_TO_NOT_DTS");
  assert.ok(found && found.severity === "fail");
});

test("R1: DTS in Special Instructions does not fail when carrier is a real carrier", () => {
  const x = pass();
  x.carrier.name = "SAIA Motor Freight Line";
  x.accessorials.other_text = "Diversified Transportation Services contracted SAIA transport";
  assert.ok(!codes(x).includes("R1_CARRIER_IS_DTS"));
});

test("R3: carrier missing -> fail", () => {
  const x = pass();
  x.carrier.name = null;
  assert.ok(codes(x).includes("R3_CARRIER_MISSING"));
});

test("R4: GES logistics selected -> fail", () => {
  const x = pass();
  x.gc_detected = "ges";
  x.carrier.gc_logistics_selected = true;
  assert.ok(codes(x).includes("R4_GC_LOGISTICS_SELECTED"));
});

test("R4: does not fire for non-GES", () => {
  const x = pass();
  x.carrier.gc_logistics_selected = true; // freeman
  assert.ok(!codes(x).includes("R4_GC_LOGISTICS_SELECTED"));
});

test("reroute state is never flagged (blank RE-ROUTE VIA is normal)", () => {
  for (const opt of ["gc_reroute", "return_to_warehouse", null] as const) {
    const x = pass();
    x.carrier_no_show_option = opt;
    const c = codes(x);
    assert.ok(!c.includes("R5_FORCED_REROUTE_SELECTED"));
    assert.ok(!c.includes("R6_NO_REROUTE_OPTION"));
  }
});

test("R7: totals mismatch -> warn", () => {
  const x = pass();
  x.total_pieces = 5; // lines say 3
  assert.ok(codes(x).includes("R7_TOTALS_MISMATCH"));
});

test("R8: no signature -> warn", () => {
  const x = pass();
  x.exhibitor_signature_present = false;
  assert.ok(codes(x).includes("R8_NO_SIGNATURE"));
});

test("Collect/Prepaid/neither is never flagged when Bill To is DTS", () => {
  for (const terms of ["collect", "prepaid", null] as const) {
    const x = pass();
    x.freight_terms = terms;
    assert.ok(!codes(x).includes("R9_FREIGHT_TERMS_COLLECT"));
  }
});

test("R10: low confidence on a rule field -> warn", () => {
  const x = pass();
  x.confidence["carrier.name"] = "low";
  assert.ok(codes(x).includes("R10_LOW_CONFIDENCE"));
});

test("R11: multiple destinations -> info", () => {
  const x = pass();
  x.separate_destinations_in_booth = 2;
  const found = evaluateRules(x, null).find((c) => c.code === "R11_MULTI_DESTINATION");
  assert.ok(found && found.severity === "info");
});

// ------------------------------ load rules ---------------------------------

test("matching load produces no load findings", () => {
  const found = codes(pass(), bookedLoad()).filter((c) => c.startsWith("L"));
  assert.deepEqual(found, []);
});

test("L1: carrier mismatch -> warn", () => {
  const load = bookedLoad();
  load.carrierName = "Old Dominion";
  assert.ok(codes(pass(), load).includes("L1_CARRIER_MISMATCH"));
});

test("L1: alias/typo carriers still match (no finding)", () => {
  const load = bookedLoad();
  load.carrierName = "UPS Freight"; // alias of T-Force
  assert.ok(!codes(pass(), load).includes("L1_CARRIER_MISMATCH"));
});

test("L2: pieces mismatch -> warn", () => {
  const load = bookedLoad();
  load.pieces = 7;
  assert.ok(codes(pass(), load).includes("L2_PIECES_MISMATCH"));
});

test("L3: weight mismatch beyond tolerance -> warn", () => {
  const load = bookedLoad();
  load.weight = 500; // vs 1000, tolerance max(100, 50)=100
  assert.ok(codes(pass(), load).includes("L3_WEIGHT_MISMATCH"));
});

test("L3: small weight delta within tolerance -> no finding", () => {
  const x = pass();
  x.total_weight_lbs = 1080; // within 10% of 1000
  assert.ok(!codes(x, bookedLoad()).includes("L3_WEIGHT_MISMATCH"));
});

test("L4: destination zip mismatch -> warn", () => {
  const load = bookedLoad();
  load.consigneeZip = "90001";
  assert.ok(codes(pass(), load).includes("L4_DESTINATION_MISMATCH"));
});

test("L5: accessorial on MHA but not booked -> warn (rebill trap)", () => {
  const x = pass();
  x.accessorials.liftgate = true;
  const load = bookedLoad();
  load.bookedAccessorials = {}; // liftgate not booked
  assert.ok(codes(x, load).includes("L5_ACCESSORIAL_NOT_BOOKED"));
});

test("L6: booked accessorial not on MHA -> info", () => {
  const x = pass();
  x.accessorials.liftgate = false;
  const load = bookedLoad();
  load.bookedAccessorials = { liftgate: true };
  const found = evaluateRules(x, load).find((c) => c.code === "L6_ACCESSORIAL_BOOKED_NOT_ON_MHA");
  assert.ok(found && found.severity === "info");
});

test("L7: booth mismatch -> info", () => {
  const load = bookedLoad();
  load.boothNumber = "Z999";
  const found = evaluateRules(pass(), load).find((c) => c.code === "L7_BOOTH_MISMATCH");
  assert.ok(found && found.severity === "info");
});

// ------------------------------ overall ------------------------------------

test("overallStatus precedence", () => {
  assert.equal(overallStatus([]), "passed");
  assert.equal(overallStatus([{ code: "x", severity: "info", title: "", detail: "", found: null, expected: null }]), "passed");
  assert.equal(overallStatus([{ code: "x", severity: "warn", title: "", detail: "", found: null, expected: null }]), "warning");
  assert.equal(
    overallStatus([
      { code: "a", severity: "warn", title: "", detail: "", found: null, expected: null },
      { code: "b", severity: "fail", title: "", detail: "", found: null, expected: null },
    ]),
    "failed",
  );
});

// ----------------------- golden GC transcription set -----------------------

function loadFixture(name: string): MhaExtraction {
  const url = new URL(`../../../__fixtures__/mha/expected/${name}.json`, import.meta.url);
  return MhaExtractionSchema.parse(JSON.parse(readFileSync(url, "utf8")));
}

for (const gc of ["freeman", "ges", "shepard"]) {
  test(`fixture ${gc}: R1 passes, R2 fails`, () => {
    const c = codes(loadFixture(gc));
    assert.ok(!c.includes("R1_CARRIER_IS_DTS"), "R1 should pass (carrier is T-Force)");
    assert.ok(c.includes("R2_BILL_TO_NOT_DTS"), "R2 should fail (bill-to is LA Manufacturing)");
  });
}

test("fixture inverted: R1 fails, R2 passes", () => {
  const c = codes(loadFixture("inverted"));
  assert.ok(c.includes("R1_CARRIER_IS_DTS"), "R1 should fail (carrier is DTS)");
  assert.ok(!c.includes("R2_BILL_TO_NOT_DTS"), "R2 should pass (bill-to is DTS)");
});

test("fixture freeman-saia (hand-corrected bill-to): zero findings -> passed", () => {
  // Real Freeman MHA: carrier SAIA, Prepaid, Bill To hand-corrected to DTS
  // (Hamilton Ave), "DTS contracted SAIA" in Special Instructions.
  const x = loadFixture("freeman-saia");
  const results = evaluateRules(x, null);
  assert.deepEqual(
    results.map((c) => c.code),
    [],
    `expected no findings, got: ${results.map((c) => `${c.code}(${c.severity})`).join(", ")}`,
  );
  assert.equal(overallStatus(results), "passed");
});

test("fixture freeman-correct (real perfect form): zero findings -> passed", () => {
  // Real Freeman MHA: TFORCE carrier, Bill To = DTS, neither Collect/Prepaid
  // checked, RE-ROUTE VIA blank. This must produce NO findings.
  const x = loadFixture("freeman-correct");
  const results = evaluateRules(x, null);
  assert.deepEqual(
    results.map((c) => c.code),
    [],
    `expected no findings, got: ${results.map((c) => `${c.code}(${c.severity})`).join(", ")}`,
  );
  assert.equal(overallStatus(results), "passed");
});
