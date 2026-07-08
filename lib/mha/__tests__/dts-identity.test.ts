import { test } from "node:test";
import assert from "node:assert/strict";
import { isDts, matchDts, looksLikeDtsAddress } from "../dts-identity";

const POSITIVES = [
  "Diversified Transportation Services",
  "Diversified Transportation Services, Inc.",
  "DIVERSIFIED TRANSPORTATION SERVICES LLC",
  "Diversified Transportation",
  "Diversified Trans",
  "DTS",
  "dts",
  "dts one",
  "dtsone",
  "T-Force DTS", // bare token with a real word boundary
];

const NEGATIVES = [
  "",
  "Dependable Highway Express",
  "TDS Logistics", // t-d-s in sequence, but not "dts"
  "T-Force Freight",
  "FedEx Freight",
  "Southeastern Freight Lines",
  "Old Dominion Freight Line",
  "Redtsun Freight", // contains "dts" as a substring — must NOT match
  "Goodts Trucking", // substring "dts" inside a token — must NOT match
  "Estes Express",
];

test("isDts: positives", () => {
  for (const v of POSITIVES) {
    assert.equal(isDts(v), true, `expected DTS match for "${v}"`);
  }
});

test("isDts: negatives (incl. substring false-positive guards)", () => {
  for (const v of NEGATIVES) {
    assert.equal(isDts(v), false, `expected NO DTS match for "${v}"`);
  }
});

test("isDts: null/undefined are safe", () => {
  assert.equal(isDts(null), false);
  assert.equal(isDts(undefined), false);
});

test("matchDts reports which alias fired", () => {
  assert.equal(matchDts("Diversified Transportation Services, Inc.").alias, "diversified transportation services");
  assert.equal(matchDts("DTS").alias, "dts");
  assert.equal(matchDts("Old Dominion").alias, null);
});

test("looksLikeDtsAddress: matches the DTS billing address, rejects others", () => {
  assert.equal(looksLikeDtsAddress("19829 Hamilton Avenue", "Torrance", "CA", "90502"), true);
  assert.equal(looksLikeDtsAddress(null, "Torrance", "CA", "90502"), true);
  assert.equal(looksLikeDtsAddress("123 Main Street", "Pasadena", "CA", "91001"), false);
  assert.equal(looksLikeDtsAddress("19829 Hamilton Avenue", "Torrance", "CA", null), true);
  assert.equal(looksLikeDtsAddress(null, "Torrance", null, null), false);
});
