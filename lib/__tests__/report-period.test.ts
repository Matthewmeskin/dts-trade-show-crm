import { test } from "node:test";
import assert from "node:assert/strict";
import { datePresets, inRange, readRange, reportQuery } from "../reports";

test("quick periods: year to date, started quarters newest first, last year", () => {
  const p = datePresets("2026-10-07");
  assert.deepEqual(p[0], { label: "2026 year to date", from: "2026-01-01", to: "2026-10-07" });
  assert.deepEqual(p[1], { label: "Q4 2026", from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(p[2], { label: "Q3 2026", from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(p.map((x) => x.label).slice(4, 9), ["Q1 2026", "Q4 2025", "Q3 2025", "Q2 2025", "Q1 2025"]);
  assert.deepEqual(p.at(-1), { label: "All of 2025", from: "2025-01-01", to: "2025-12-31" });
  // On Jan 2 only Q1 of this year has started.
  assert.deepEqual(datePresets("2027-01-02").map((x) => x.label).slice(0, 3), ["2027 year to date", "Q1 2027", "Q4 2026"]);
});

test("the period from the URL", () => {
  assert.deepEqual(readRange("2026-07-01", "2026-09-30"), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(readRange("2026-09-30", "2026-07-01"), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(readRange("2026-13-01", "junk"), { from: null, to: null });
  assert.deepEqual(readRange(undefined, "2026-09-30"), { from: null, to: "2026-09-30" });
});

test("in the period", () => {
  const q3 = { from: "2026-07-01", to: "2026-09-30" };
  assert.equal(inRange("2026-07-01", q3), true);
  assert.equal(inRange("2026-09-30", q3), true);
  assert.equal(inRange("2026-10-01", q3), false);
  assert.equal(inRange(null, q3), false);
  assert.equal(inRange(null, { from: null, to: null }), true);
  assert.equal(inRange("2026-01-05", { from: null, to: "2026-03-31" }), true);
});

test("report links keep the show and the period", () => {
  assert.equal(reportQuery({ show: "abc", from: "2026-07-01", to: "2026-09-30" }), "?show=abc&from=2026-07-01&to=2026-09-30");
  assert.equal(reportQuery({}), "");
});
