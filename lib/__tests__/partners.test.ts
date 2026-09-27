import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingBlockers,
  loopState,
  parseImport,
  parsePartnerType,
  splitLine,
  suggestQualification,
  weekStart,
  weeklyNumbers,
} from "../partners";

// The qualification bar and the 24-hour loop are what the admin and reps are
// measured on, so the rules the UI shows have to match what the database holds.

test("influence: 3+ clients, or any GSC or organizer", () => {
  const shows: { name: string; start: string | null }[] = [];
  assert.equal(suggestQualification({ partner_type: "exhibit_house", client_count: 3 }, shows, "2026-09-26").influence, true);
  assert.equal(suggestQualification({ partner_type: "exhibit_house", client_count: 2 }, shows, "2026-09-26").influence, false);
  assert.equal(suggestQualification({ partner_type: "exhibit_house", client_count: null }, shows, "2026-09-26").influence, false);
  assert.equal(suggestQualification({ partner_type: "gsc", client_count: null }, shows, "2026-09-26").influence, true);
  assert.equal(suggestQualification({ partner_type: "organizer", client_count: 0 }, shows, "2026-09-26").influence, true);
});

test("show soon: the next linked show inside 120 days", () => {
  const q = suggestQualification(
    { partner_type: "exhibit_house", client_count: 10 },
    [
      { name: "Past Expo", start: "2026-09-01" },
      { name: "Far Expo", start: "2027-03-01" },
      { name: "SEMA", start: "2026-11-03" },
      { name: "No date", start: null },
    ],
    "2026-09-26",
  );
  assert.equal(q.showSoon, true);
  assert.deepEqual(q.nextShow, { name: "SEMA", start: "2026-11-03" });
  assert.equal(q.agreedTime, null);
  const none = suggestQualification({ partner_type: "gsc", client_count: null }, [{ name: "Far", start: "2027-02-01" }], "2026-09-26");
  assert.equal(none.showSoon, false);
});

test("booking needs all three rules and the full handoff note", () => {
  const ok = {
    q_influence: true,
    q_show_120: true,
    q_agreed_time: true,
    signal: "Replied to LinkedIn",
    shows_note: "SEMA — 6 clients",
    shipping_pain: "Outbound left to the show carrier",
    rep_id: "r1",
    scheduled_at: "2026-10-01T17:00",
  };
  assert.deepEqual(bookingBlockers(ok), []);
  assert.equal(bookingBlockers({ ...ok, q_agreed_time: false }).length, 1);
  assert.equal(bookingBlockers({ ...ok, shipping_pain: "  " }).length, 1);
  assert.equal(bookingBlockers({ ...ok, q_influence: false, q_show_120: false, signal: "" }).length, 3);
});

test("the rep's loop: due after the call, overdue after 24 hours, closed with an outcome", () => {
  const at = "2026-09-25T17:00:00Z";
  const call = { status: "booked", scheduled_at: at, outcome: null };
  assert.equal(loopState(call, new Date("2026-09-25T16:00:00Z")), "upcoming");
  assert.equal(loopState(call, new Date("2026-09-26T16:00:00Z")), "due");
  assert.equal(loopState(call, new Date("2026-09-26T18:00:00Z")), "overdue");
  assert.equal(loopState({ ...call, status: "held", outcome: "good_fit" }, new Date("2026-09-30T00:00:00Z")), "closed");
  assert.equal(loopState({ ...call, status: "no_show" }, new Date("2026-09-30T00:00:00Z")), "closed");
});

test("weeks start Monday, Pacific", () => {
  assert.equal(weekStart("2026-09-26"), "2026-09-21"); // Saturday
  assert.equal(weekStart("2026-09-27"), "2026-09-21"); // Sunday
  assert.equal(weekStart("2026-09-28"), "2026-09-28"); // Monday
});

test("weekly numbers count partners worked, conversations, booked, held and show rate", () => {
  const touches = [
    { partner_id: "a", reached: true, occurred_at: "2026-09-22T17:00:00Z" },
    { partner_id: "a", reached: false, occurred_at: "2026-09-23T17:00:00Z" },
    { partner_id: "b", reached: false, occurred_at: "2026-09-24T17:00:00Z" },
    // Sunday 9pm Pacific the week before is Monday UTC - still last week here.
    { partner_id: "c", reached: true, occurred_at: "2026-09-21T04:00:00Z" },
  ];
  const calls = [
    { created_at: "2026-09-22T18:00:00Z", scheduled_at: "2026-09-23T18:00:00Z", status: "held", outcome: "good_fit" },
    { created_at: "2026-09-22T18:00:00Z", scheduled_at: "2026-09-24T18:00:00Z", status: "no_show", outcome: null },
    { created_at: "2026-09-15T18:00:00Z", scheduled_at: "2026-09-25T18:00:00Z", status: "held", outcome: "next_step" },
    { created_at: "2026-09-10T18:00:00Z", scheduled_at: "2026-09-12T18:00:00Z", status: "booked", outcome: null },
  ];
  const n = weeklyNumbers(touches, calls, "2026-09-26", new Date("2026-09-26T20:00:00Z"));
  assert.equal(n.worked, 2);
  assert.equal(n.conversations, 1);
  assert.equal(n.booked, 2);
  assert.equal(n.held, 2);
  assert.equal(n.showRate, 2 / 3);
  assert.equal(n.overdueOutcomes, 1);
});

test("splitLine honours quotes and doubled quotes", () => {
  assert.deepEqual(splitLine('"Acme, Inc.",Exhibit house,"says ""hi"""', ","), ["Acme, Inc.", "Exhibit house", 'says "hi"']);
  assert.deepEqual(splitLine("a\tb\t c ", "\t"), ["a", "b", "c"]);
});

test("partner type from free text", () => {
  assert.equal(parsePartnerType("Booth builder"), "exhibit_house");
  assert.equal(parsePartnerType("Regional GSC"), "gsc");
  assert.equal(parsePartnerType("Association / show organizer"), "organizer");
  assert.equal(parsePartnerType("I&D"), "agency");
  assert.equal(parsePartnerType("Experiential agency"), "agency");
  assert.equal(parsePartnerType(""), "exhibit_house");
  assert.equal(parsePartnerType("Printer"), "other");
});

test("import: header aliases, tabs, dedupe and nameless rows", () => {
  const { rows, problems } = parseImport(
    [
      "Company\tType\tTier\tWebsite\tCity\tState\t# Clients\tNotes",
      "Acme Exhibits\tBuilder\t1\tacme-exhibits.com\tAnaheim\tCA\t25\tDoes SEMA every year",
      "\tGSC\t2\t\t\t\t\t",
      "acme exhibits\tBuilder\t2\t\t\t\t\t",
      "Pacific Expo Services\tRegional GSC\tTier 2\t\tLong Beach\tCA\t\t",
      "Odd Tier Co\tOther\t7\tnot a site\t\t\t1,200\t",
    ].join("\n"),
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    name: "Acme Exhibits",
    partner_type: "exhibit_house",
    tier: 1,
    website: "https://acme-exhibits.com",
    city: "Anaheim",
    state: "CA",
    client_count: 25,
    source: null,
    notes: "Does SEMA every year",
  });
  assert.equal(rows[1].partner_type, "gsc");
  assert.equal(rows[1].tier, 2);
  assert.equal(rows[2].tier, null);
  assert.equal(rows[2].website, null);
  assert.equal(rows[2].client_count, 1200);
  assert.equal(problems.length, 2);
});

test("import without a name column says so", () => {
  const r = parseImport("Website,City\nx.com,LA");
  assert.equal(r.rows.length, 0);
  assert.match(r.problems[0], /company name/);
});

test("stages only move forward on their own, and never out of nurture / not a fit", async () => {
  const { advanceStage } = await import("../partners");
  assert.equal(advanceStage("target", "working"), "working");
  assert.equal(advanceStage("booked", "conversation"), null);
  assert.equal(advanceStage("not_fit", "working"), null);
  assert.equal(advanceStage("nurture", "booked"), null);
  assert.equal(advanceStage("held", "held"), null);
});

test("call times typed in Pacific are stored as the right instant, DST included", async () => {
  const { pacificWallToIso, isoToPacificWall, formatPacificDateTime } = await import("../format");
  assert.equal(pacificWallToIso("2026-10-06T10:00"), "2026-10-06T17:00:00.000Z"); // PDT
  assert.equal(pacificWallToIso("2026-12-01T10:00"), "2026-12-01T18:00:00.000Z"); // PST
  assert.equal(pacificWallToIso("2026-11-01T09:30"), "2026-11-01T17:30:00.000Z"); // the day DST ends
  assert.equal(pacificWallToIso("nope"), null);
  assert.equal(isoToPacificWall("2026-10-06T17:00:00.000Z"), "2026-10-06T10:00");
  assert.match(formatPacificDateTime("2026-10-06T17:00:00.000Z"), /Oct 6, 10:00\sAM PT/);
});

test("stack check: DTS keeps at least $30 and half the margin", async () => {
  const { stackCheck } = await import("../partners");
  // $200 margin, 15% rebate, 20% commission before rebate: 30 + 40 = 70 out, keeps 130.
  const a = stackCheck({ margin: 200, rebatePct: 15, commissionPct: 20, commissionBasis: "before_rebate" });
  assert.equal(a.rebate, 30);
  assert.equal(a.commission, 40);
  assert.equal(a.dtsKeeps, 130);
  assert.equal(a.ok, true);
  // After the rebate, commission is on 170.
  const b = stackCheck({ margin: 200, rebatePct: 15, commissionPct: 20, commissionBasis: "after_rebate" });
  assert.equal(b.commission, 34);
  assert.equal(b.dtsKeeps, 136);
  // A thin load fails the $30 floor even at a fine percentage.
  const thin = stackCheck({ margin: 50, rebatePct: 10, commissionPct: 20, commissionBasis: "before_rebate" });
  assert.equal(thin.dtsKeeps, 35);
  assert.equal(thin.ok, true);
  const thinner = stackCheck({ margin: 40, rebatePct: 10, commissionPct: 20, commissionBasis: "before_rebate" });
  assert.equal(thinner.ok, false);
  assert.match(thinner.reasons[0], /\$30/);
  // A big rebate fails the 50% rule on any load.
  const greedy = stackCheck({ margin: 1000, rebatePct: 30, commissionPct: 25, commissionBasis: "before_rebate" });
  assert.equal(greedy.ok, false);
  assert.match(greedy.reasons.join(" "), /50%/);
});

test("partner codes from company names", async () => {
  const { suggestCode, PARTNER_CODE_SHAPE } = await import("../partners");
  assert.equal(suggestCode("Pacific Exhibit Services, Inc."), "pacific-exhibit-services");
  assert.equal(suggestCode("A&B Expo Co."), "a-and-b-expo");
  assert.ok(PARTNER_CODE_SHAPE.test(suggestCode("  Weird!!  Name  LLC ")));
});
