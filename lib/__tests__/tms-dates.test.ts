import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseLoad } from "../tms";

/**
 * Hyperion sends instants, not calendar dates, and its own UI renders them in
 * Pacific time. Reading the UTC date off the string puts every late-evening
 * pickup on the following day — which is how load 127957 showed on the 23rd in
 * the calendar while the TMS showed the 22nd.
 */
describe("TMS dates land on the day Hyperion shows", () => {
  test("an 11pm Pacific pickup keeps its own date, not the UTC one", () => {
    // The real payload for load 127957. Hyperion displays it as 09-22, 11:00 pm.
    const parsed = parseLoad({ loadId: 127957, pickupDate: "2026-09-23T06:00:46.856Z" });
    assert.equal(parsed?.fields.pickup_date, "2026-09-22");
  });

  test("a midnight Pacific pickup is unchanged", () => {
    // Midnight PDT on 2026-10-02 is 07:00Z the same day — the case that always worked.
    const parsed = parseLoad({ loadId: 1, pickupDate: "2026-10-02T07:00:02.572Z" });
    assert.equal(parsed?.fields.pickup_date, "2026-10-02");
  });

  test("standard time is handled too, not just daylight time", () => {
    // 2026-11-09T07:00Z is 11pm PST on 11-08 (DST ended 11-01), so a fixed -7
    // offset would get this one wrong.
    const parsed = parseLoad({ loadId: 2, pickupDate: "2026-11-09T07:00:58.12Z" });
    assert.equal(parsed?.fields.pickup_date, "2026-11-08");
  });

  test("delivery estimates get the same treatment", () => {
    const parsed = parseLoad({ loadId: 3, estimated_delivery_date: "2026-09-26T04:30:00.000Z" });
    assert.equal(parsed?.fields.estimated_delivery_date, "2026-09-25");
  });

  test("a bare calendar date is taken as written", () => {
    const parsed = parseLoad({ loadId: 4, pickupDate: "2026-09-22" });
    assert.equal(parsed?.fields.pickup_date, "2026-09-22");
  });

  test("a US-format date still parses", () => {
    const parsed = parseLoad({ loadId: 5, pickupDate: "9/22/2026" });
    assert.equal(parsed?.fields.pickup_date, "2026-09-22");
  });

  test("a zoneless timestamp falls back to its date part rather than guessing", () => {
    const parsed = parseLoad({ loadId: 6, pickupDate: "2026-09-22T23:00:00" });
    assert.equal(parsed?.fields.pickup_date, "2026-09-22");
  });
});
