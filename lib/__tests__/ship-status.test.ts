import { test } from "node:test";
import assert from "node:assert/strict";
import { changed, publicStatus, stageAfterExhibitor, statusRow } from "../ship-status";
import { exhibitorPatch, legPatch, legRows, standing, type PulledRequest } from "../ship-intake";

test("the exhibitor's action moves the CRM stage, never past a booking", () => {
  assert.deepEqual(stageAfterExhibitor("quoted", "approved"), { stage: "approved", approved: true });
  // Approving something we never priced changes nothing.
  assert.equal(stageAfterExhibitor("new", "approved").stage, "new");
  // A new weight on a priced leg: price it again.
  assert.equal(stageAfterExhibitor("quoted", "requested").stage, "new");
  assert.equal(stageAfterExhibitor("approved", "requested").stage, "new");
  assert.equal(stageAfterExhibitor("quoted", "cancelled").stage, "cancelled");
  // Booked stays booked whatever arrives.
  assert.equal(stageAfterExhibitor("booked", "cancelled").stage, "booked");
  assert.equal(stageAfterExhibitor("booked", "requested").stage, "booked");
});

test("public status comes from the stage, then from the booked load", () => {
  assert.equal(publicStatus("new", null), "requested");
  assert.equal(publicStatus("quoted", null), "quoted");
  assert.equal(publicStatus("approved", null), "approved");
  assert.equal(publicStatus("booked", null), "booked");
  assert.equal(publicStatus("booked", "in_transit"), "in_transit");
  assert.equal(publicStatus("booked", "delivered"), "delivered");
  assert.equal(publicStatus("booked", "issue"), "issue");
  assert.equal(publicStatus("booked", "quoted"), "booked");
  assert.equal(publicStatus("cancelled", "delivered"), "cancelled");
});

test("a status row carries tracking only once booked, and never a price", () => {
  const load = { status: "in_transit", pro_number: "123", pickup_date: "2026-11-01", estimated_delivery_date: "2026-11-04", actual_delivery_date: null, carrier_name: "Sample Freight" };
  const quoted = statusRow({ public_leg_id: "p1", stage: "quoted" }, 3, load);
  assert.equal(quoted.carrier_name, null);
  assert.equal(quoted.version, 3);
  const moving = statusRow({ public_leg_id: "p1", stage: "booked" }, 3, load);
  assert.equal(moving.status, "in_transit");
  assert.equal(moving.pro_number, "123");
  assert.equal(moving.est_delivery, "2026-11-04");
  // Once delivered, the estimate goes and the real date shows.
  const done = statusRow({ public_leg_id: "p1", stage: "booked" }, 3, { ...load, status: "delivered", actual_delivery_date: "2026-11-03" });
  assert.equal(done.est_delivery, null);
  assert.equal(done.delivered_on, "2026-11-03");
  assert.deepEqual(Object.keys(moving).sort(), ["carrier_name", "delivered_on", "est_delivery", "leg_id", "pickup_date", "pro_number", "status", "version"]);
});

test("only news is sent: a version bump alone is not a change", () => {
  const row = statusRow({ public_leg_id: "p1", stage: "quoted" }, 2, null);
  assert.equal(changed(row, null), true);
  assert.equal(changed(row, { ...row, version: 1 }), false);
  assert.equal(changed(row, { ...row, status: "requested" }), true);
});

const leg = {
  id: "pub-leg", direction: "outbound" as const, seq: 1, place_name: null, street1: "1", street2: null, city: "C", state: "OH", zip: "43004",
  location_type: "business_dock", liftgate: false, inside: false, ready_date: null, inbound_to: null, own_carrier: false, deliver_by: null,
  onsite_contact_name: "A", onsite_contact_mobile: "5", return_to_warehouse: true, pieces: 3, weight_lbs: 900, packaging: "crates",
  largest_l_in: null, largest_w_in: null, largest_h_in: null, description: null, hazmat: false,
};
const req = (over: Partial<PulledRequest>): PulledRequest => ({
  id: "pub-req", public_ref: "SC-AAAA-BBBB", partner_id: "p", show_id: "s", show: {}, company: "Co", contact_name: "P",
  email: "e@example.invalid", mobile: "5", booth: "1203", booth_tbd: false, on_behalf_of: null, declared_value: null,
  wants_coverage: false, marketing_consent: false, marketing_consent_text: null, terms_accepted_at: null, created_at: null,
  confirmed_at: null, legs: [leg], ...over,
});
const known = { partners: new Set(["p"]), shows: new Set(["s"]), shipShows: new Set(["p:s"]) };

test("a newer version updates the booth, the legs and the stage", () => {
  const patch = exhibitorPatch(req({ version: 4, booth: "1300" }), known, { closed: null });
  assert.equal(patch.booth, "1300");
  assert.equal(patch.exhibitor_version, 4);
  assert.equal(patch.closed, undefined);
  const lp = legPatch({ ...leg, status: "approved", approved_at: "2026-10-01T00:00:00Z" }, "quoted");
  assert.equal(lp.stage, "approved");
  assert.equal(lp.approved_at, "2026-10-01T00:00:00Z");
  assert.equal(legPatch({ ...leg, status: "requested" }, "approved").approved_at, null);
});

test("an exhibitor's cancel closes the request, unless staff already closed it", () => {
  const p = exhibitorPatch(req({ version: 2, status: "cancelled" }), known, { closed: null });
  assert.equal(p.closed, "cancelled");
  assert.equal(p.pushed_closed, true);
  assert.equal(exhibitorPatch(req({ version: 2, status: "cancelled" }), known, { closed: "rejected" }).closed, undefined);
  // First seen already cancelled: the legs arrive cancelled too.
  assert.equal(legRows(req({ legs: [{ ...leg, status: "cancelled" }] }), "x")[0].stage, "cancelled");
});

test("an open change request puts the request on the to do list", () => {
  assert.equal(standing(null, [{ stage: "booked", own_carrier: false, direction: "outbound" }], 1).key, "change");
  assert.equal(standing("cancelled", [], 1).key, "closed");
});
