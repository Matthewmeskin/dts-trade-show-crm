import { test } from "node:test";
import assert from "node:assert/strict";
import { inboxRow, legName, legRows, LOAD_NUMBER, problemsFor, shipmentForLeg, standing, type PulledRequest } from "../ship-intake";
import { legFreight, legRoute, quoteEmail } from "../ship-quote";

const P = "00000000-0000-4000-8000-00000000b001";
const S = "00000000-0000-4000-8000-00000000c001";

function req(over: Partial<PulledRequest> = {}): PulledRequest {
  return {
    id: "00000000-0000-4000-8000-00000000d001",
    public_ref: "SC-7K3Q-X9PM",
    partner_id: P,
    show_id: S,
    show: { show_name: "Sample Expo", year: 2027, gsc_name: "Sample Exposition Services" },
    company: "Sample Exhibitor Co",
    contact_name: "Sample Person",
    email: "person@example.invalid",
    mobile: "555-0100",
    booth: "1203",
    booth_tbd: false,
    on_behalf_of: null,
    declared_value: "25000.00",
    wants_coverage: false,
    marketing_consent: false,
    marketing_consent_text: "Email me",
    terms_accepted_at: "2026-09-28T10:00:00Z",
    created_at: "2026-09-28T10:00:00Z",
    confirmed_at: "2026-09-28T10:05:00Z",
    legs: [
      {
        id: "00000000-0000-4000-8000-00000000e001", direction: "outbound", seq: 1, place_name: null,
        street1: "10 Sample Way", street2: null, city: "Sampletown", state: "OH", zip: "43004",
        location_type: "business_dock", liftgate: false, inside: false, ready_date: null, inbound_to: null,
        own_carrier: false, deliver_by: null, onsite_contact_name: "Sample Lead", onsite_contact_mobile: "555-0101",
        return_to_warehouse: true, pieces: 2, weight_lbs: 650, packaging: "crates", largest_l_in: null,
        largest_w_in: null, largest_h_in: null, description: null, hazmat: false,
      },
    ],
    ...over,
  };
}

const known = { partners: new Set([P]), shows: new Set([S]), shipShows: new Set([`${P}:${S}`]) };

test("a clean request has nothing to flag and keeps the CRM's ids", () => {
  const r = req();
  assert.deepEqual(problemsFor(r, known), []);
  const row = inboxRow(r, known);
  assert.equal(row.partner_id, P);
  assert.equal(row.show_id, S);
  assert.equal(row.declared_value, 25000);
  // Consent wording is kept only when they said yes.
  assert.equal(row.marketing_consent_text, null);
  assert.equal(inboxRow(req({ marketing_consent: true }), known).marketing_consent_text, "Email me");
  const legs = legRows(r, "inbox-id");
  assert.equal(legs[0].request_id, "inbox-id");
  assert.equal(legs[0].public_leg_id, r.legs[0].id);
});

test("unknown GSC or show is flagged and stored without the broken link", () => {
  const r = req();
  const none = { partners: new Set<string>(), shows: new Set<string>(), shipShows: new Set<string>() };
  const p = problemsFor(r, none);
  assert.ok(p.some((x) => /GSC .* not in the CRM/.test(x)));
  assert.ok(p.some((x) => /show .* no longer in the CRM/.test(x)));
  const row = inboxRow(r, none);
  assert.equal(row.partner_id, null);
  assert.equal(row.show_id, null);
  // Known both, but not linked as a Shipping Center show.
  const unlinked = { ...known, shipShows: new Set<string>() };
  assert.ok(problemsFor(r, unlinked).some((x) => /does not run this show/.test(x)));
});

test("hazmat, residential, booth TBD and coverage are flagged for a person", () => {
  const r = req({
    booth_tbd: true,
    booth: null,
    wants_coverage: true,
    legs: [{ ...req().legs[0], hazmat: true, location_type: "residential" }],
  });
  const p = problemsFor(r, known).join(" | ");
  assert.match(p, /Outbound: marked hazardous/);
  assert.match(p, /Outbound: a residence/);
  assert.match(p, /Booth not assigned yet/);
  assert.match(p, /\$25,000/);
});

test("leg names and where a request stands", () => {
  assert.equal(legName("outbound", 1), "Outbound");
  assert.equal(legName("inbound", 2, 2), "Inbound 2");
  assert.equal(legName("inbound", 1, 1), "Inbound");
  const leg = (stage: string, own_carrier = false) => ({ stage, own_carrier, direction: "inbound" });
  assert.equal(standing(null, [leg("new"), leg("quoted")]).key, "quote");
  assert.equal(standing(null, [leg("quoted"), leg("booked")]).key, "waiting");
  assert.equal(standing(null, [leg("approved"), leg("quoted")]).key, "book");
  assert.equal(standing(null, [leg("booked"), leg("cancelled")]).key, "booked");
  assert.equal(standing(null, [leg("new", true)]).label, "Labels only");
  assert.equal(standing("rejected", [leg("new")]).label, "Rejected");
});

test("a booked leg becomes a Shipping Center shipment, never partner credited", () => {
  const leg = { ...req().legs[0], id: "leg-1", direction: "inbound", inbound_to: "direct", ready_date: "2026-11-01", liftgate: true };
  const s = shipmentForLeg(leg, { show_id: S, booth: "1203", company: "Co", contact_name: "P", mobile: "5" }, "123456");
  assert.equal(s.source, "ship_center");
  assert.equal(s.ship_leg_id, "leg-1");
  assert.equal(s.direction, "move_in");
  assert.equal(s.destination_type, "direct_to_show");
  assert.equal(s.origin_city, "Sampletown");
  assert.equal(s.special_requirements, "liftgate");
  assert.equal("partner_id" in s, false);
  const out = shipmentForLeg({ ...leg, direction: "outbound" }, { show_id: S, booth: null, company: "Co", contact_name: "P", mobile: "5" }, "123457");
  assert.equal(out.direction, "move_out");
  assert.equal(out.consignee_city, "Sampletown");
  assert.equal(out.destination_type, null);
  assert.ok(LOAD_NUMBER.test("1234567") && !LOAD_NUMBER.test("12") && !LOAD_NUMBER.test("12 34"));
});

test("the quote email: every leg, the total, broker words only", () => {
  const legs = [
    { direction: "outbound", city: "Sampletown", state: "OH", inbound_to: null, pieces: 2, weight_lbs: 650, packaging: "crates", liftgate: false, inside: false },
    { direction: "inbound", city: "Sampletown", state: "OH", inbound_to: "advance_warehouse", pieces: 1, weight_lbs: 1200, packaging: "pallets", liftgate: true, inside: false },
  ];
  const m = quoteEmail({
    publicRef: "SC-7K3Q-X9PM", showName: "Sample Expo", year: 2027, gscName: "Sample Exposition Services",
    booth: "1203", contactName: "Sample Person",
    lines: legs.map((l, i) => ({ name: i ? "Inbound" : "Outbound", route: legRoute(l), freight: legFreight(l), amount: i ? 412.5 : 687 })),
    note: null, staffName: "Sample Coordinator", staffPhone: null, officePhone: "(800) 460-8540",
  });
  assert.match(m.subject, /Sample Expo 2027.*SC-7K3Q-X9PM/);
  assert.match(m.text, /^Hi Sample,/);
  assert.match(m.text, /Outbound: \$687\.00\n  From the show to Sampletown, OH/);
  assert.match(m.text, /Inbound: \$412\.50\n  From Sampletown, OH to the advance warehouse\n  1 piece, 1,200 lb, pallets, with liftgate/);
  assert.match(m.text, /Total: \$1,099\.50/);
  assert.match(m.text, /billed by Sample Exposition Services/);
  assert.match(m.text, /Nothing is booked until you do/);
  assert.doesNotMatch(m.text, /guarantee|on time|no surprises|handled|vetted|reliable|—|–/i);
  assert.doesNotMatch(m.text, /Freeman|GES/);
});
