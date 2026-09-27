import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildManifest,
  candidateReason,
  manifestCadence,
  manifestDue,
  type CandidateShow,
  type ManifestShipment,
} from "../gsc-manifest";

// The manifest goes to a GSC's warehouse. These pin when it's owed, what's on
// it, what's held back, and how an unlinked load gets matched to the show.

const show: CandidateShow = {
  id: "sema",
  show_name: "SEMA",
  show_start_date: "2026-11-03",
  show_end_date: "2026-11-06",
  move_in_start: "2026-10-29",
  move_in_end: "2026-11-02",
  move_out_start: "2026-11-06",
  move_out_end: "2026-11-09",
  advance_warehouse_open: "2026-10-01",
  advance_warehouse_cutoff: "2026-10-24",
  advance_warehouse_name: "Sample Warehouse",
  venue_id: "lvcc",
  advance_warehouse_zip: "89118",
  direct_to_show_zip: "89109",
};

test("cadence: nothing far out, weekly from 45 days, daily the last week, outbound from opening", () => {
  assert.equal(manifestCadence(show, "2026-09-01"), "none");
  assert.equal(manifestCadence(show, "2026-09-27"), "weekly");
  assert.equal(manifestCadence(show, "2026-10-22"), "daily");
  assert.equal(manifestCadence(show, "2026-11-03"), "outbound");
  assert.equal(manifestCadence(show, "2026-11-12"), "outbound"); // move-out + 3
  assert.equal(manifestCadence(show, "2026-11-13"), "none");
  assert.equal(manifestCadence({ ...show, move_in_start: null, show_start_date: null }, "2026-10-22"), "none");
});

test("due: weekly once per Monday-week, daily once per day", () => {
  assert.equal(manifestDue("weekly", null, "2026-09-27"), true);
  assert.equal(manifestDue("weekly", "2026-09-22", "2026-09-27"), false); // sent this week
  assert.equal(manifestDue("weekly", "2026-09-20", "2026-09-27"), true); // last week
  assert.equal(manifestDue("daily", "2026-10-22", "2026-10-22"), false);
  assert.equal(manifestDue("daily", "2026-10-21", "2026-10-22"), true);
  assert.equal(manifestDue("none", null, "2026-10-22"), false);
});

const ship = (p: Partial<ManifestShipment>): ManifestShipment => ({
  id: Math.random().toString(36).slice(2),
  exhibitor: "Acme Audio",
  direction: "move_in",
  status: "booked",
  destination_type: "advance_warehouse",
  booth_number: "4412",
  pieces: 3,
  weight: 850,
  carrier: "Sample Freight",
  pro_number: "PRO1",
  pickup_date: "2026-10-12",
  estimated_delivery_date: "2026-10-15",
  actual_delivery_date: null,
  origin_city: "Anaheim",
  origin_state: "CA",
  ...p,
});

test("inbound manifest: moving freight only, by booth, with totals; quotes and stale loads held back", () => {
  const m = buildManifest({
    gscName: "Sample GSC",
    show,
    shipments: [
      ship({ booth_number: "900", exhibitor: "Bolt Brakes", pieces: 2, weight: 400 }),
      ship({ booth_number: "12", exhibitor: "Acme Audio" }),
      ship({ status: "quoted", exhibitor: "Quote Only Co" }),
      ship({ status: "booked", pickup_date: "2026-09-01", estimated_delivery_date: "2026-09-03", exhibitor: "Stale Co", pro_number: "OLD" }),
      ship({ direction: "move_out", booth_number: "12", exhibitor: "Acme Audio", pickup_date: "2026-11-07" }),
    ],
    today: "2026-10-10",
    rep: { name: "Dana Rep", phone: null, email: null },
  });
  assert.equal(m.kind, "inbound");
  assert.deepEqual(m.inbound.map((r) => r.booth), ["12", "900"]);
  assert.deepEqual(m.totals, { loads: 2, pieces: 5, weight: 1250 });
  assert.equal(m.outbound.length, 1);
  assert.deepEqual(m.outboundMissing, ["Bolt Brakes"]);
  assert.equal(m.needsCheck.length, 1);
  assert.ok(!m.html.includes("Quote Only Co"));
  assert.ok(!m.html.includes("OLD"));
  assert.match(m.subject, /inbound manifest for Sample GSC/);
  for (const word of ["margin", "cost", "billed", "rate"]) assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(m.text), word);
});

test("from the show's opening it becomes the outbound list", () => {
  const m = buildManifest({
    gscName: "Sample GSC",
    show,
    shipments: [ship({ direction: "move_out", pickup_date: "2026-11-07", estimated_delivery_date: "2026-11-10" })],
    today: "2026-11-04",
    rep: null,
  });
  assert.equal(m.kind, "outbound");
  assert.equal(m.totals.loads, 1);
  assert.match(m.html, /Outbound booked with DTS/);
  assert.match(m.html, /Pickup Nov 7/);
});

test("an empty manifest says so instead of sending a blank table", () => {
  const m = buildManifest({ gscName: "G", show, shipments: [], today: "2026-10-10", rep: null });
  assert.match(m.html, /Nothing booked with DTS for this show yet/);
});

const cand = (p: Partial<Parameters<typeof candidateReason>[1]>) => ({
  id: "x",
  venue_id: null,
  direction: "move_in",
  pickup_date: "2026-10-12",
  show_date: null,
  created_at: "2026-10-01T00:00:00Z",
  consignee_zip: null,
  origin_zip: null,
  ...p,
});

test("candidate loads: in the freight window and pointed at the warehouse, the site or the venue", () => {
  assert.match(candidateReason(show, cand({ consignee_zip: "89118-1234" }))!, /advance warehouse/);
  assert.match(candidateReason(show, cand({ consignee_zip: "89109" }))!, /show-site/);
  assert.match(candidateReason(show, cand({ direction: "move_out", origin_zip: "89109", pickup_date: "2026-11-07" }))!, /Picks up/);
  assert.match(candidateReason(show, cand({ venue_id: "lvcc" }))!, /Same venue/);
  // Right place, wrong time: a June load at the same venue is some other show.
  assert.equal(candidateReason(show, cand({ venue_id: "lvcc", pickup_date: "2026-06-10" })), null);
  // Right time, nowhere near.
  assert.equal(candidateReason(show, cand({ consignee_zip: "10001" })), null);
});

test("test and house accounts never reach a partner email; delivered loads don't show an ETA", async () => {
  const { isInternalAccount } = await import("../gsc-manifest");
  assert.ok(isInternalAccount("Jimmy W Test 2025"));
  assert.ok(isInternalAccount("Jasmine's Test Account"));
  assert.ok(isInternalAccount("General Quote Account"));
  assert.ok(isInternalAccount("Diversified Transportation Services"));
  assert.ok(!isInternalAccount("Testa Robotics")); // a real company that starts with "Test"
  assert.ok(!isInternalAccount("Tiger Vac"));
  const m = buildManifest({
    gscName: "G",
    show,
    shipments: [
      ship({ exhibitor: "Jimmy W Test 2025", status: "booked" }),
      ship({ exhibitor: "Real Co", status: "delivered", estimated_delivery_date: "2026-10-15", actual_delivery_date: null }),
    ],
    today: "2026-10-20",
    rep: null,
  });
  assert.deepEqual(m.inbound.map((r) => r.exhibitor), ["Real Co"]);
  assert.equal(m.inbound[0].when, "Delivered");
});
