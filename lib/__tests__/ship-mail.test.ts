import { test } from "node:test";
import assert from "node:assert/strict";
import { daysFrom, dueReminders, localDay, localHour, reminderEmail, type ReminderLeg, type ReminderKind } from "../ship-reminders";
import { buildShipManifest, type ManifestLeg, type ManifestRequest } from "../ship-manifest";

test("the show's own day and hour", () => {
  const at = new Date("2026-11-02T06:30:00Z"); // 11:30 pm Nov 1 in Los Angeles, 1:30 am Nov 2 in New York
  assert.equal(localDay("America/Los_Angeles", at), "2026-11-01");
  assert.equal(localDay("America/New_York", at), "2026-11-02");
  assert.equal(localHour("America/Chicago", at), 0);
  assert.equal(daysFrom("2026-11-01", "2026-11-08"), 7);
});

const leg = (over: Partial<ReminderLeg>): ReminderLeg => ({
  id: "l1", direction: "inbound", seq: 1, stage: "new", own_carrier: false, ready_date: null, pieces: 3,
  pickup_date: null, quoted_at: null, ...over,
});
const show = { move_in_start: "2026-11-10", show_start_date: "2026-11-12", move_out_start: "2026-11-14", show_end_date: "2026-11-14" };
const kinds = (today: string, r: Parameters<typeof dueReminders>[0]) => dueReminders(r, show, today).map((d) => d.key);

test("booth TBD: two weeks out, then five days out, then never", () => {
  // An outbound leg, so only the booth reminder is in play.
  const r = { id: "r", closed: null, email: "e@example.invalid", booth_tbd: true, legs: [leg({}), leg({ id: "o", direction: "outbound" })] };
  assert.deepEqual(kinds("2026-10-20", r), []);
  assert.deepEqual(kinds("2026-10-27", r), ["booth_tbd:r:14"]);
  assert.deepEqual(kinds("2026-11-05", r), ["booth_tbd:r:5"]);
  assert.deepEqual(kinds("2026-11-11", r), []);
});

test("inbound with no outbound: 7 and 2 days before move out", () => {
  const r = { id: "r", closed: null, email: "e@example.invalid", booth_tbd: false, legs: [leg({})] };
  assert.deepEqual(kinds("2026-11-07", r), ["no_outbound:r:7"]);
  assert.deepEqual(kinds("2026-11-12", r), ["no_outbound:r:2"]);
  const withOut = { ...r, legs: [leg({}), leg({ id: "o", direction: "outbound" })] };
  assert.deepEqual(kinds("2026-11-07", withOut), []);
  // A cancelled outbound doesn't count as a way home.
  const cancelledOut = { ...r, legs: [leg({}), leg({ id: "o", direction: "outbound", stage: "cancelled" })] };
  assert.deepEqual(kinds("2026-11-07", cancelledOut), ["no_outbound:r:7"]);
});

test("a price waiting two days is nudged once per price", () => {
  const r = { id: "r", closed: null, email: "e@example.invalid", booth_tbd: false,
    legs: [leg({ stage: "quoted", quoted_at: "2026-10-01T15:00:00Z" }), leg({ id: "o", direction: "outbound", stage: "quoted", quoted_at: "2026-10-01T16:00:00Z" })] };
  assert.deepEqual(kinds("2026-10-02", r), []);
  assert.deepEqual(kinds("2026-10-03", r), ["quote_waiting:r:2026-10-01T16:00:00Z"]);
});

test("checklists the day before pickup and move out, only when booked", () => {
  const r = { id: "r", closed: null, email: "e@example.invalid", booth_tbd: false,
    legs: [leg({ stage: "booked", pickup_date: "2026-11-01" }), leg({ id: "o", direction: "outbound", stage: "booked" })] };
  assert.deepEqual(kinds("2026-10-31", r), ["pickup_checklist:l1:2026-11-01"]);
  assert.deepEqual(kinds("2026-11-13", r), ["moveout_checklist:r:2026-11-14"]);
  assert.deepEqual(kinds("2026-11-13", { ...r, legs: [leg({ id: "o", direction: "outbound", stage: "quoted" })] }).filter((k) => k.startsWith("moveout")), []);
});

test("closed requests and removed contacts get nothing", () => {
  const legs = [leg({})];
  assert.deepEqual(kinds("2026-11-07", { id: "r", closed: "cancelled", email: "e@example.invalid", booth_tbd: true, legs }), []);
  assert.deepEqual(kinds("2026-11-07", { id: "r", closed: null, email: null, booth_tbd: true, legs }), []);
});

test("every reminder speaks as a broker and names no national contractor", () => {
  const all: ReminderKind[] = ["booth_tbd", "no_outbound", "quote_waiting", "pickup_checklist", "moveout_checklist"];
  for (const k of all) {
    const m = reminderEmail(k, {
      publicRef: "SC-7K3Q-X9PM", contactName: "Sample Person", showName: "Sample Expo", year: 2026, gscName: "Sample Show Services",
      booth: "1203", moveIn: "2026-11-10", moveOut: "2026-11-14", requestUrl: "https://ship.example/ship/x/y/2026/request/",
      linkUrl: "https://ship.example/ship/link/?ref=SC-7K3Q-X9PM", pickupDate: "2026-11-01", pieces: 3, onsiteName: "Sample Lead",
      onsiteMobile: "555-0101", staffName: null, phone: "(800) 460-8540",
    });
    const all = `${m.subject}\n${m.text}`;
    assert.match(all, /SC-7K3Q-X9PM/, k);
    assert.doesNotMatch(all, /guarantee|on time|no surprises|no forced freight|handled|vetted|reliable carrier|safe carrier|—|–/i, k);
    assert.doesNotMatch(all, /Freeman|\bGES\b/, k);
  }
  assert.match(reminderEmail("moveout_checklist", {
    publicRef: "SC-A", contactName: null, showName: "S", year: 2026, gscName: "G", booth: null, moveIn: null, moveOut: "2026-11-14",
    requestUrl: null, linkUrl: null, pickupDate: null, pieces: null, onsiteName: "Lead", onsiteMobile: "555", staffName: null, phone: "x",
  }).text, /material handling agreement[\s\S]*G service desk[\s\S]*bill of lading/);
});

const mleg = (over: Partial<ManifestLeg>): ManifestLeg => ({
  direction: "inbound", seq: 1, stage: "new", own_carrier: false, inbound_to: "advance_warehouse", city: "Sampletown", state: "OH",
  pieces: 4, weight_lbs: 1800, ready_date: "2026-11-01", onsite_contact_name: null, load: null, ...over,
});
const mreq = (over: Partial<ManifestRequest>): ManifestRequest => ({
  company: "Sample Exhibitor Co", contact_name: "Sample Person", booth: "1203", booth_tbd: false, closed: null, legs: [mleg({})], ...over,
});

test("the GSC's inbound manifest: by booth, never a price or an exhibitor's email or phone", () => {
  const m = buildShipManifest({
    kind: "inbound", gscName: "Sample Show Services", showName: "Sample Expo", year: 2026, today: "2026-10-20",
    requests: [
      mreq({ booth: "1500" }),
      mreq({ booth: "300", legs: [mleg({ stage: "booked", inbound_to: "direct", load: { status: "in_transit", carrier_name: "Sample Freight", pro_number: "123", pickup_date: "2026-10-18", estimated_delivery_date: "2026-10-22", actual_delivery_date: null } })] }),
      mreq({ booth_tbd: true, booth: null }),
      mreq({ closed: "cancelled", booth: "900" }),
      mreq({ booth: "950", legs: [mleg({ own_carrier: true })] }),
      mreq({ booth: "960", legs: [mleg({ stage: "cancelled" })] }),
    ],
  });
  assert.deepEqual(m.lines.map((l) => l.booth), ["300", "1500", "TBD"]);
  assert.equal(m.lines[0].where, "Show site");
  assert.equal(m.lines[0].status, "Picked up");
  assert.equal(m.lines[0].carrier, "Sample Freight");
  assert.equal(m.lines[0].when, "Carrier's estimate Oct 22");
  assert.equal(m.lines[1].status, "Not booked yet");
  assert.equal(m.lines[1].carrier, "");
  assert.match(m.subject, /Sample Expo 2026: DTS inbound manifest, Oct 20/);
  assert.doesNotMatch(m.text, /amount|margin|rate|cost/i);
  for (const part of [m.text, m.html]) {
    assert.doesNotMatch(part, /\$|@|—|–/);
    assert.match(part, /3 shipments coming in with DTS: 12 pieces, about 5,400 lb/);
  }
});

test("the outbound list names booths with no way home", () => {
  const m = buildShipManifest({
    kind: "outbound", gscName: "G", showName: "S", year: 2026, today: "2026-11-13",
    requests: [
      mreq({ booth: "1200", legs: [mleg({ direction: "outbound", onsite_contact_name: "Lead", city: "Columbus" })] }),
      mreq({ booth: "700" }),
    ],
  });
  assert.equal(m.lines.length, 1);
  assert.equal(m.lines[0].contact, "Lead");
  assert.equal(m.lines[0].where, "Columbus, OH");
  assert.deepEqual(m.noOutbound, [{ booth: "700", company: "Sample Exhibitor Co" }]);
  assert.match(m.html, /no outbound yet/);
});
