import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist, buildRecommendations, RETURN_TO_WAREHOUSE_TEXT } from "../checklist";
import { evaluateRules } from "../rules";
import { MhaExtractionSchema, type MhaExtraction } from "../extraction";

function clean(): MhaExtraction {
  return MhaExtractionSchema.parse({
    gc_detected: "freeman",
    carrier: { name: "T-Force Freight" },
    bill_to: {
      company: "Diversified Transportation Services",
      street: "19829 Hamilton Ave",
      city: "Torrance",
      state: "CA",
      zip: "90502",
    },
    commodities: [{ description: "Skids", pieces: 3, weight_lbs: 1000 }],
    total_pieces: 3,
    total_weight_lbs: 1000,
    exhibitor_signature_present: true,
    carrier_no_show_option: "return_to_warehouse",
  });
}

const byLabel = (items: ReturnType<typeof buildChecklist>, label: string) =>
  items.find((i) => i.label.startsWith(label));

test("checklist: clean form, no load -> base points all pass", () => {
  const x = clean();
  const items = buildChecklist(x, evaluateRules(x, null), false);
  assert.ok(items.every((i) => i.status === "pass"));
  assert.equal(byLabel(items, "Carrier is a real carrier")?.status, "pass");
  assert.equal(byLabel(items, "Freight is billed to DTS")?.status, "pass");
});

test("checklist: reflects a hard failure", () => {
  const x = clean();
  x.carrier.name = "Diversified Transportation Services";
  const items = buildChecklist(x, evaluateRules(x, null), false);
  assert.equal(byLabel(items, "Carrier is a real carrier")?.status, "fail");
});

test("checklist: unsigned -> warn; unknown signature -> na", () => {
  const warn = clean();
  warn.exhibitor_signature_present = false;
  assert.equal(
    byLabel(buildChecklist(warn, evaluateRules(warn, null), false), "Signed")?.status,
    "warn",
  );
  const na = clean();
  na.exhibitor_signature_present = null;
  assert.equal(
    byLabel(buildChecklist(na, evaluateRules(na, null), false), "Signed")?.status,
    "na",
  );
});

test("checklist: GES adds the GC-logistics point", () => {
  const x = clean();
  x.gc_detected = "ges";
  const labels = buildChecklist(x, evaluateRules(x, null), false).map((i) => i.label);
  assert.ok(labels.some((l) => l.includes("GC's own carrier")));
});

test("checklist: load match adds booking-comparison points", () => {
  const x = clean();
  const items = buildChecklist(x, [], true);
  assert.ok(items.some((i) => i.label.includes("matches the booking")));
});

test("recommendations: reroute wording offered unless already return-to-warehouse", () => {
  const blank = clean();
  blank.carrier_no_show_option = null;
  const recs = buildRecommendations(blank, null);
  const reroute = recs.find((r) => r.copy);
  assert.equal(reroute?.copy, RETURN_TO_WAREHOUSE_TEXT);

  const already = clean(); // return_to_warehouse
  assert.equal(buildRecommendations(already, null).some((r) => r.copy), false);
});

test("recommendations: offers booked pieces/weight when the form left them blank", () => {
  const x = clean();
  x.total_pieces = null;
  x.total_weight_lbs = null;
  const recs = buildRecommendations(x, { pieces: 4, weight: 850 });
  const fill = recs.find((r) => r.title.includes("piece count"));
  assert.ok(fill && /4 pieces/.test(fill.detail) && /850 lbs/.test(fill.detail));
});

test("recommendations: no pieces/weight rec when the form already has them", () => {
  const recs = buildRecommendations(clean(), { pieces: 4, weight: 850 });
  assert.equal(recs.some((r) => r.title.includes("piece count")), false);
});
