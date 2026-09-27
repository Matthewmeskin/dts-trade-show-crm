import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRebateDraft,
  creditSuggestions,
  parseQuarter,
  quarterOf,
  recentQuarters,
  renderStatementHtml,
  renderStatementText,
  type ArRow,
  type CreditedShipment,
} from "../rebates";

// Rebates are paid on gross margin, only on paid invoices, once per load. These
// pin who gets on a statement, what's held back, and what the partner sees.

test("quarters: calendar quarters, labels round-trip, walk backward across a year", () => {
  assert.deepEqual(quarterOf("2026-09-27"), { label: "2026-Q3", start: "2026-07-01", end: "2026-09-30" });
  assert.deepEqual(quarterOf("2026-02-10"), { label: "2026-Q1", start: "2026-01-01", end: "2026-03-31" });
  assert.equal(quarterOf("2026-12-31").end, "2026-12-31");
  assert.deepEqual(parseQuarter("2026-Q4"), quarterOf("2026-11-01"));
  assert.equal(parseQuarter("2026-Q5"), null);
  assert.deepEqual(recentQuarters("2026-02-01", 3).map((q) => q.label), ["2026-Q1", "2025-Q4", "2025-Q3"]);
});

const ship = (p: Partial<CreditedShipment>): CreditedShipment => ({
  id: Math.random().toString(36).slice(2),
  tms_reference_id: "120001",
  status: "delivered",
  billed_amount: 1000,
  cost_amount: 700,
  cancelled_at: null,
  pickup_date: "2026-10-05",
  exhibitor_name: "Acme Audio",
  show_name: "Sample Expo",
  partner_credit_source: "referral_code",
  ...p,
});
const paid = (id: string, paid_on: string, invoiced = 1000): ArRow => ({
  shipment_id: id,
  ar_status: "paid",
  invoice_nos: ["N120001"],
  invoiced,
  open_balance: 0,
  paid_on,
});

const q4 = parseQuarter("2026-Q4")!;
const draft = (shipments: CreditedShipment[], ar: ArRow[], extra: Partial<Parameters<typeof buildRebateDraft>[0]> = {}) =>
  buildRebateDraft({ quarter: q4, incentiveModel: "rebate", rebatePct: 15, shipments, ar, alreadyStated: new Set(), quarterIssued: false, today: "2027-01-10", ...extra });

test("a paid, credited load earns its share of margin; unpaid and quoted loads don't", () => {
  const a = ship({ tms_reference_id: "120001" });
  const open = ship({ tms_reference_id: "120002" });
  const notYet = ship({ tms_reference_id: "120003" });
  const quote = ship({ tms_reference_id: "120004", status: "quoted" });
  const d = draft(
    [a, open, notYet, quote],
    [
      paid(a.id, "2026-11-20"),
      { shipment_id: open.id, ar_status: "open", invoice_nos: ["N120002"], invoiced: 1000, open_balance: 1000, paid_on: null },
      { shipment_id: notYet.id, ar_status: "not_in_ledger", invoice_nos: [], invoiced: null, open_balance: null, paid_on: null },
    ],
  );
  assert.equal(d.lines.length, 1);
  assert.equal(d.lines[0].margin, 300);
  assert.equal(d.lines[0].rebate, 45);
  assert.deepEqual(d.totals, { loads: 1, billed: 1000, margin: 300, rebate: 45 });
  assert.deepEqual(d.waiting.map((w) => w.tms_reference_id), ["120002", "120003"]);
  assert.match(d.waiting[0].why, /not paid yet/);
  assert.equal(d.waiting[0].owed, 1000);
  assert.deepEqual(d.blockers, []);
});

test("Sage's invoiced amount is the billed figure; a TMS mismatch is noted, not held", () => {
  const a = ship({ billed_amount: 1000, cost_amount: 700 });
  const d = draft([a], [paid(a.id, "2026-10-15", 1085.5)]);
  assert.equal(d.lines[0].billed, 1085.5);
  assert.equal(d.lines[0].margin, 385.5);
  assert.equal(d.checks.length, 0);
  assert.equal(d.notes.length, 1);
  assert.match(d.notes[0].problem, /Using Sage/);
});

test("Sage with no invoice amount (its extract today) falls back to the TMS billed amount", () => {
  const a = ship({ billed_amount: 1000, cost_amount: 700 });
  const d = draft([a], [paid(a.id, "2026-10-15", 0)]);
  assert.equal(d.lines[0].billed, 1000);
  assert.equal(d.lines[0].margin, 300);
  assert.equal(d.notes.length, 0);
});

test("paid after the quarter waits for the next one; paid before it is carried in", () => {
  const later = ship({ tms_reference_id: "1" });
  const earlier = ship({ tms_reference_id: "2" });
  const d = draft([later, earlier], [paid(later.id, "2027-01-03"), paid(earlier.id, "2026-08-30")]);
  assert.equal(d.paidAfter, 1);
  assert.equal(d.lines.length, 1);
  assert.equal(d.lines[0].carried, true);
});

test("a load already on a statement is never paid again", () => {
  const a = ship({});
  const d = draft([a], [paid(a.id, "2026-10-15")], { alreadyStated: new Set([a.id]) });
  assert.equal(d.lines.length, 0);
  assert.ok(d.blockers.some((b) => /No paid, credited loads/.test(b)));
});

test("no cost, no margin, or cancelled-but-paid: held for a person to look at", () => {
  const noCost = ship({ tms_reference_id: "1", cost_amount: null });
  const underwater = ship({ tms_reference_id: "2", cost_amount: 1200 });
  const cancelled = ship({ tms_reference_id: "3", cancelled_at: "2026-10-02T00:00:00Z" });
  const d = draft([noCost, underwater, cancelled], [paid(noCost.id, "2026-10-10"), paid(underwater.id, "2026-10-10"), paid(cancelled.id, "2026-10-10")]);
  assert.equal(d.lines.length, 0);
  assert.equal(d.checks.length, 3);
  assert.match(d.checks.find((c) => c.tms_reference_id === "1")!.problem, /No carrier cost/);
  assert.match(d.checks.find((c) => c.tms_reference_id === "2")!.problem, /Margin is \$-200\.00/);
  assert.match(d.checks.find((c) => c.tms_reference_id === "3")!.problem, /cancelled/);
});

test("blockers: wrong model, no %, quarter already issued", () => {
  const a = ship({});
  const ar = [paid(a.id, "2026-10-15")];
  assert.match(draft([a], ar, { incentiveModel: "markup" }).blockers[0], /isn't on the rebate model/);
  assert.match(draft([a], ar, { rebatePct: null }).blockers[0], /No rebate %/);
  assert.equal(draft([a], ar, { rebatePct: null }).lines[0].rebate, 0);
  assert.match(draft([a], ar, { quarterIssued: true }).blockers[0], /already has a statement/);
  assert.match(draft([a], ar, { today: "2026-12-31" }).blockers[0], /isn't over until Dec 31, 2026/);
});

test("credit suggestions: the partner's clients' booked loads since they were linked, uncredited only, never Shipping Center loads", () => {
  const base = { partner_id: null, status: "booked", cancelled_at: null, tms_reference_id: "1", show_name: null, billed_amount: 500 };
  const s = creditSuggestions(
    [{ exhibitor_id: "acme", company_name: "Acme Audio", linked_on: "2026-10-01" }],
    [
      { ...base, id: "ok", exhibitor_id: "acme", booked_on: "2026-10-05" },
      { ...base, id: "before-link", exhibitor_id: "acme", booked_on: "2026-09-20" },
      { ...base, id: "credited", exhibitor_id: "acme", booked_on: "2026-10-06", partner_id: "other" },
      { ...base, id: "quote", exhibitor_id: "acme", booked_on: "2026-10-06", status: "quoted" },
      { ...base, id: "cancelled", exhibitor_id: "acme", booked_on: "2026-10-06", cancelled_at: "2026-10-07" },
      { ...base, id: "stranger", exhibitor_id: "bolt", booked_on: "2026-10-06" },
      { ...base, id: "ship-center", exhibitor_id: "acme", booked_on: "2026-10-06", source: "ship_center" },
    ],
  );
  assert.deepEqual(s.map((x) => x.id), ["ok"]);
  assert.match(s[0].reason, /Acme Audio is their client/);
});

test("the partner's statement shows rebates, never cost, margin or billed", () => {
  const input = {
    partnerName: "Sample Exposition Services",
    quarter: q4,
    rebatePct: 15,
    lines: [{ tms_reference_id: "120001", exhibitor_name: "Acme <Audio>", show_name: "Sample Expo", paid_on: "2026-11-20", rebate: 45 }],
    rebateTotal: 45,
    rep: null,
  };
  const html = renderStatementHtml(input);
  const text = renderStatementText(input);
  assert.match(html, /Q4 2026/);
  assert.match(html, /\$45\.00/);
  assert.match(html, /Acme &lt;Audio&gt;/);
  const visible = html.replace(/<[^>]+>/g, " ");
  for (const out of [visible, text]) {
    for (const word of ["cost", "billed", "carrier"]) assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(out), word);
    // The terms name "DTS gross margin" as the basis; no margin figure appears.
    assert.ok(!/margin/i.test(out.replace(/DTS gross margin/g, "")), "margin figure");
  }
});
