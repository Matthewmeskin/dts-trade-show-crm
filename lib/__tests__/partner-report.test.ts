import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPartnerReport, type ReportShipment } from "../partner-report";

// The report goes to someone outside DTS. These pin what it shows, what it
// leaves off, and the outbound check that is the whole point of sending it.

const today = "2026-09-27";
const clients = [
  { exhibitor_id: "e1", company_name: "Acme Audio", in_pilot: true },
  { exhibitor_id: "e2", company_name: "Bolt Brakes", in_pilot: true },
  { exhibitor_id: "e3", company_name: "Crest Coatings", in_pilot: false },
];
const shows = [
  { id: "sema", show_name: "SEMA", start: "2026-11-03", end: "2026-11-06" },
  { id: "old", show_name: "Old Expo", start: "2026-08-01", end: "2026-08-03" },
  { id: "far", show_name: "Far Expo", start: "2027-03-01", end: "2027-03-03" },
];
const ship = (p: Partial<ReportShipment>): ReportShipment => ({
  id: Math.random().toString(36).slice(2),
  exhibitor_id: "e1",
  show_id: "sema",
  direction: "move_in",
  status: "booked",
  destination_type: "advance_warehouse",
  pickup_date: "2026-10-10",
  estimated_delivery_date: "2026-10-15",
  actual_delivery_date: null,
  show_date: null,
  created_at: "2026-09-20T00:00:00Z",
  pro_number: "PRO123",
  tracking_url: "https://track.example/PRO123",
  booth_number: "4412",
  pieces: 3,
  origin_city: "Anaheim",
  origin_state: "CA",
  consignee_city: "Las Vegas",
  consignee_state: "NV",
  ...p,
});
const rep = { name: "Dana Rep", phone: "555-0100", email: "dana@example.com" };

test("outbound gaps: clients at a show coming up with no outbound booked", () => {
  const r = buildPartnerReport({
    partnerName: "Pacific Exhibits",
    clients,
    shows,
    rosters: [{ show_id: "sema", exhibitor_id: "e3" }],
    shipments: [
      ship({ exhibitor_id: "e1" }),
      ship({ exhibitor_id: "e1", direction: "move_out", status: "booked", pickup_date: "2026-11-06" }),
      ship({ exhibitor_id: "e2" }),
      // A quoted outbound doesn't count as booked.
      ship({ exhibitor_id: "e2", direction: "move_out", status: "quoted", pickup_date: "2026-11-06" }),
    ],
    today,
    rep,
  });
  assert.deepEqual(
    r.gaps.map((g) => g.client),
    ["Bolt Brakes", "Crest Coatings"],
  );
  assert.equal(r.counts.outboundGaps, 2);
  assert.equal(r.counts.outboundBooked, 1);
  assert.equal(r.counts.inMotion, 2);
  assert.equal(r.counts.quoted, 1);
});

test("shows far out or already over don't raise outbound gaps", () => {
  const r = buildPartnerReport({
    partnerName: "P",
    clients,
    shows,
    rosters: [
      { show_id: "far", exhibitor_id: "e1" },
      { show_id: "old", exhibitor_id: "e2" },
    ],
    shipments: [],
    today,
    rep,
  });
  assert.equal(r.gaps.length, 0);
  assert.equal(r.empty, true);
  assert.match(r.html, /No freight moving/);
});

test("stale open records and old deliveries are left off; recent deliveries stay", () => {
  const r = buildPartnerReport({
    partnerName: "P",
    clients,
    shows,
    rosters: [],
    shipments: [
      ship({ status: "booked", pickup_date: "2026-06-01" }), // stale open record
      ship({ status: "delivered", actual_delivery_date: "2026-08-01", show_id: "old" }), // old delivery
      ship({ status: "delivered", actual_delivery_date: "2026-09-20" }), // recent delivery
      ship({ exhibitor_id: "someone-else" }), // not this partner's client
    ],
    today,
    rep,
  });
  const rows = r.groups.flatMap((g) => g.rows);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "Delivered");
  assert.equal(r.counts.delivered, 1);
});

test("groups by show, soonest first, with freight that has no show last", () => {
  const r = buildPartnerReport({
    partnerName: "P",
    clients,
    shows,
    rosters: [],
    shipments: [ship({ show_id: null, direction: null }), ship({ show_id: "sema" })],
    today,
    rep,
  });
  assert.deepEqual(
    r.groups.map((g) => g.title),
    ["SEMA", "Other freight"],
  );
  assert.equal(r.groups[1].rows[0].kind, "Shipment · booth 4412");
  assert.equal(r.groups[1].rows[0].route, "Anaheim, CA → Las Vegas, NV");
});

test("the email carries status, PRO and tracking — and nothing internal", () => {
  const r = buildPartnerReport({
    partnerName: "Pacific <Exhibits>",
    clients,
    shows,
    rosters: [],
    shipments: [ship({ status: "in_transit" }), ship({ exhibitor_id: "e2", status: "issue" as string })],
    today,
    rep,
  });
  assert.match(r.html, /PRO123/);
  assert.match(r.html, /https:\/\/track\.example\/PRO123/);
  assert.match(r.html, /Pacific &lt;Exhibits&gt;/);
  assert.match(r.html, /We're working on it/);
  assert.equal(r.counts.attention, 1);
  assert.match(r.subject, /week of/);
  assert.match(r.text, /Dana Rep · 555-0100/);
  for (const word of ["margin", "cost", "billed", "rate"]) {
    assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(r.text), word);
  }
});

test("a tracking value that isn't a web link is not turned into one", () => {
  const r = buildPartnerReport({
    partnerName: "P",
    clients,
    shows,
    rosters: [],
    shipments: [ship({ tracking_url: "javascript:alert(1)" })],
    today,
    rep,
  });
  assert.equal(r.groups[0].rows[0].tracking, null);
  assert.ok(!r.html.includes("javascript:"));
});

test("quotes show only while they can still be booked, and never with tracking", () => {
  const r = buildPartnerReport({
    partnerName: "P",
    clients,
    shows,
    rosters: [],
    shipments: [
      ship({ status: "quoted", pickup_date: "2026-10-20" }), // still bookable
      ship({ status: "quoted", pickup_date: "2026-09-10" }), // pickup passed: likely lost
      ship({ status: "quoted", pickup_date: null, created_at: "2026-09-25T00:00:00Z" }), // fresh, no date
      ship({ status: "quoted", pickup_date: null, created_at: "2026-08-01T00:00:00Z" }), // old, no date
    ],
    today,
    rep,
  });
  const rows = r.groups.flatMap((g) => g.rows);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.tracking === null && row.pro === null));
});

test("loads the TMS still shows moving long after their dates stay out of the email and go to the rep", () => {
  const r = buildPartnerReport({
    partnerName: "P",
    clients,
    shows,
    rosters: [],
    shipments: [
      ship({ status: "booked", pickup_date: "2026-09-02", estimated_delivery_date: "2026-09-04", pro_number: "OLD1" }),
      ship({ status: "in_transit", pickup_date: "2026-09-24", estimated_delivery_date: "2026-09-26" }), // 1 day late: fine
      ship({ status: "booked", pickup_date: "2026-09-25", estimated_delivery_date: "2026-08-18" }), // bad ETA
    ],
    today,
    rep,
  });
  assert.equal(r.needsCheck.length, 1);
  assert.equal(r.needsCheck[0].pro, "OLD1");
  assert.ok(!r.html.includes("OLD1"));
  const rows = r.groups.flatMap((g) => g.rows);
  assert.equal(rows.length, 2);
  const bad = rows.find((row) => row.detail.includes("pickup Sep 25"))!;
  assert.ok(!bad.detail.includes("expected"), bad.detail);
  assert.equal(r.counts.inMotion, 2);
});
