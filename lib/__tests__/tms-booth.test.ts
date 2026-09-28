import { test } from "node:test";
import assert from "node:assert/strict";
import { boothForSync } from "../tms";

test("the TMS sync fills a booth only onto a shipment that has none", () => {
  assert.equal(boothForSync("1203", null), "1203");
  assert.equal(boothForSync("1203", ""), "1203");
  assert.equal(boothForSync("1203", "  "), "1203");
  // Typed in on the shipment (or from a Shipping Center request): kept.
  assert.equal(boothForSync("1203", "1203A"), undefined);
  // Nothing parsed from the stop notes: nothing written, the typed booth stays.
  assert.equal(boothForSync(undefined, "1203A"), undefined);
  assert.equal(boothForSync(undefined, null), undefined);
});
