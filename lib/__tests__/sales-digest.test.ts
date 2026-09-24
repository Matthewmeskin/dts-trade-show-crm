import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDigest, type DigestShow } from "../sales-digest";

const today = "2026-09-24";
const show = (over: Partial<DigestShow>): DigestShow => ({
  id: "id", show_name: "Show", edition_year: 2026, show_start_date: "2026-12-01", show_end_date: "2026-12-03",
  lead_gen_owner: "Joy", lead_gen_start_date: null, lead_gen_completion_date: null,
  emailed_two_weeks: false, week_before_sent: false, instantly_created: false, sales_people: "Kevin", ...over,
});

test("the digest sorts shows into overdue, due this week and no-rep, and writes a subject", () => {
  const d = buildDigest([
    show({ id: "a", show_name: "Late Expo", show_start_date: "2026-11-01", show_end_date: "2026-11-02" }), // call was due Sep 2
    show({ id: "b", show_name: "Soon Expo", show_start_date: "2026-11-27", show_end_date: "2026-11-28" }), // call due Sep 28
    show({ id: "c", show_name: "Far Expo", show_start_date: "2027-03-01", show_end_date: "2027-03-02", sales_people: "No sales rep yet" }),
    show({ id: "d", show_name: "Old Expo", show_start_date: "2026-01-01", show_end_date: "2026-01-02" }),
  ], today);
  assert.deepEqual(d.overdue.map((i) => i.showName), ["Late Expo"]);
  assert.deepEqual(d.dueSoon.map((i) => i.showName), ["Soon Expo"]);
  assert.deepEqual(d.noRep.map((i) => i.showName), ["Far Expo"]);
  assert.equal(d.counts.upcoming, 3);
  assert.equal(d.subject, "Sales calendar: 1 overdue, 1 due this week");
  assert.match(d.html, /Late Expo/);
  assert.match(d.html, /22 days overdue/);
  assert.match(d.html, /no sales rep/);
  assert.match(d.html, /shows\/a/);
});

test("a quiet week says so", () => {
  const d = buildDigest([show({ show_start_date: "2027-06-01", show_end_date: "2027-06-02" })], today);
  assert.equal(d.subject, "Sales calendar: nothing due this week (1 upcoming shows)");
  assert.equal(d.overdue.length + d.dueSoon.length, 0);
});

test("html escapes what people typed", () => {
  const d = buildDigest([show({ show_name: "A <b>&</b> B", show_start_date: "2026-11-01", show_end_date: "2026-11-02" })], today);
  assert.match(d.html, /A &lt;b&gt;&amp;&lt;\/b&gt; B/);
});
