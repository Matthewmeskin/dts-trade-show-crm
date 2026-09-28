import { test } from "node:test";
import assert from "node:assert/strict";
import { evergreenName, gscMatches, normalizeCompany, shipPath, shipShowStatus } from "../ship-center";

test("company names reduce to the words that identify them", () => {
  assert.equal(normalizeCompany("A Classic Expo Design (BRI, Inc.)"), "a classic expo design");
  assert.equal(normalizeCompany("Excel Decorators, Inc."), "excel decorators");
  assert.equal(normalizeCompany("Fern Exposition & Event Services"), "fern exposition and event services");
  assert.equal(normalizeCompany(null), "");
});

test("a Shipping Center only matches shows the GSC itself runs", () => {
  const classic = { name: "A Classic Expo Design (BRI, Inc.)", public_name: null };
  assert.equal(gscMatches("A Classic Expo Design", classic), true);
  assert.equal(gscMatches("a classic expo design inc", classic), true);
  assert.equal(gscMatches("Freeman", classic), false);
  assert.equal(gscMatches("", classic), false);
  assert.equal(gscMatches(null, classic), false);
  // Another contractor that merely shares a word never matches.
  assert.equal(gscMatches("Classic Rentals", classic), false);
  assert.equal(gscMatches("Excel", { name: "Excel Decorators, Inc." }), true);
  assert.equal(gscMatches("Shepard", { name: "Excel Decorators, Inc." }), false);
  // The public name counts too.
  assert.equal(gscMatches("Excel Expo", { name: "Excel Decorators, Inc.", public_name: "Excel Expo" }), true);
});

test("one status and one next step per show", () => {
  const today = "2026-10-01";
  assert.equal(shipShowStatus(true, "verified", "2026-12-01", today).state, "on");
  assert.equal(shipShowStatus(true, "verified", "2026-12-01", today).action, "turn_off");
  assert.equal(shipShowStatus(true, "stale", "2026-12-01", today).action, "reconfirm");
  assert.equal(shipShowStatus(true, "draft", "2026-12-01", today).state, "on_hidden");
  assert.equal(shipShowStatus(false, "verified", "2026-12-01", today).action, "turn_on");
  assert.equal(shipShowStatus(false, "stale", "2026-12-01", today).state, "reconfirm");
  assert.equal(shipShowStatus(false, "none", "2026-12-01", today).action, "set_up");
  assert.equal(shipShowStatus(false, "draft", null, today).action, "set_up");
  assert.equal(shipShowStatus(true, "verified", "2026-09-01", today).state, "past");
});

test("the exhibitor address and the evergreen name", () => {
  assert.equal(shipPath("excel-decorators", "sample-expo", 2027), "/ship/excel-decorators/sample-expo/2027");
  assert.equal(evergreenName("Sample Expo 2027"), "Sample Expo");
  assert.equal(evergreenName("Sample Expo"), "Sample Expo");
});

test("status copy stays broker-safe and dash-free", () => {
  const states: Array<[boolean, "verified" | "stale" | "draft" | "none", string | null]> = [
    [true, "verified", "2099-01-01"], [true, "stale", "2099-01-01"], [true, "draft", "2099-01-01"],
    [false, "verified", "2099-01-01"], [false, "stale", "2099-01-01"], [false, "none", "2099-01-01"], [true, "verified", "2000-01-01"],
  ];
  for (const [on, d, end] of states) {
    const s = shipShowStatus(on, d, end, "2026-10-01");
    const text = `${s.label} ${s.detail}`;
    assert.ok(!/—|–/.test(text), text);
    assert.ok(!/guarantee|on time|no surprises|handled/i.test(text), text);
  }
});
