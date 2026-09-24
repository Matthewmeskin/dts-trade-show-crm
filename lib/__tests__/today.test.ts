import { test } from "node:test";
import assert from "node:assert/strict";
import { dayOf, formatDate, parseDate, today, todayYMD } from "../format";

// The server clock is UTC. These pin "today" to the Pacific calendar day.

test("6:58pm Pacific on the 23rd is still the 23rd, not the 24th", () => {
  const now = new Date("2026-09-24T01:58:00Z"); // 18:58 PDT on 2026-09-23
  assert.equal(todayYMD(now), "2026-09-23");
});

test("just after Pacific midnight rolls to the new day", () => {
  const now = new Date("2026-09-24T07:30:00Z"); // 00:30 PDT on 2026-09-24
  assert.equal(todayYMD(now), "2026-09-24");
});

test("handles standard time offsets too", () => {
  const now = new Date("2026-12-24T07:30:00Z"); // 23:30 PST on 2026-12-23
  assert.equal(todayYMD(now), "2026-12-23");
});

test("today() is that calendar day at local midnight", () => {
  const d = today(new Date("2026-09-24T01:58:00Z"));
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 23);
  assert.equal(d.getHours(), 0);
});

test("dayOf renders an instant on its Pacific calendar day", () => {
  assert.equal(dayOf("2026-09-24T01:58:00+00:00"), "2026-09-23");
  assert.equal(dayOf(new Date("2026-09-24T07:30:00Z")), "2026-09-24");
  assert.equal(dayOf(null), null);
  assert.equal(dayOf("not a date"), null);
});

test("parseDate takes a timestamptz on its Pacific day, and a bare date as written", () => {
  // Postgres timestamptz shape via supabase-js.
  const evening = parseDate("2026-09-23T23:31:08.527603+00:00");
  assert.equal(evening?.getDate(), 23);
  const lateUtc = parseDate("2026-09-24T01:58:00Z");
  assert.equal(lateUtc?.getDate(), 23);
  assert.equal(formatDate("2026-09-24T01:58:00Z"), "Sep 23, 2026");
  // A date column is a calendar day already; never shift it.
  assert.equal(formatDate("2026-09-24"), "Sep 24, 2026");
  // A zoneless timestamp is taken at its face date.
  assert.equal(formatDate("2026-09-24T01:58:00"), "Sep 24, 2026");
});
