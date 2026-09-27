import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KIT_LOGISTICS_FIELDS,
  KIT_SCHEMA,
  KIT_SHOW_FACTS,
  compareFacts,
  htmlToText,
  isFetchableUrl,
  normalizeTime,
  parseKitReading,
} from "../kit-reader";

// The reader only drafts. These tests pin the rules that keep a bad reading
// from landing in the form: anything malformed is dropped, not half-filled.

const v = (value: string, where = "p. 4") => ({ value, where });
const blank = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, v("", "")]));

test("the reader can never fill our own notes or the verification fields", () => {
  const fields: readonly string[] = KIT_LOGISTICS_FIELDS;
  for (const f of ["dts_public_notes", "verification_status", "verified_by", "last_verified_at", "source_url"]) {
    assert.ok(!fields.includes(f), f);
  }
});

test("the schema stays a flat list, small enough for the API to compile", () => {
  // 24 required nested objects came back as "compiled grammar is too large".
  assert.deepEqual(KIT_SCHEMA.required, ["kit_year", "found", "warnings"]);
  assert.deepEqual(KIT_SCHEMA.properties.found.items.required, ["field", "value", "where"]);
  assert.ok(JSON.stringify(KIT_SCHEMA).length < 800);
});

test("the flat list folds back into logistics and facts; unknown fields and our own notes are dropped", () => {
  const r = parseKitReading({
    kit_year: "2026",
    found: [
      { field: "advance_cutoff_local", value: "3:30 PM", where: "p. 12, Warehouse" },
      { field: "move_in_start", value: "2026-11-01", where: "p. 3, Schedule" },
      { field: "advance_warehouse_address", value: "Sample Warehouse, 100 Dock Rd, Las Vegas, NV 89118", where: "p. 12" },
      { field: "dts_public_notes", value: "Should never land", where: "" },
      { field: "made_up_field", value: "x", where: "" },
      { field: "move_in_start", value: "2026-11-05", where: "a repeat" },
      { field: "gsc_url", value: "", where: "" },
    ],
    warnings: [],
  })!;
  assert.deepEqual(r.logistics, { advance_cutoff_local: { value: "15:30", where: "p. 12, Warehouse" } });
  assert.equal(r.facts.move_in_start?.value, "2026-11-01");
  assert.match(r.facts.advance_warehouse_address!.value, /100 Dock Rd/);
  assert.ok(!("dts_public_notes" in r.logistics));
});

test("empty values mean the kit didn't say, and are dropped", () => {
  const r = parseKitReading({
    kit_year: "2026",
    logistics: { ...blank(KIT_LOGISTICS_FIELDS), marshalling_yard_note: v("Check in at the yard before the dock.") },
    facts: blank(KIT_SHOW_FACTS),
    warnings: ["", "Two deadlines disagree"],
  });
  assert.ok(r);
  assert.deepEqual(Object.keys(r.logistics), ["marshalling_yard_note"]);
  assert.deepEqual(r.facts, {});
  assert.deepEqual(r.warnings, ["Two deadlines disagree"]);
});

test("bad timezones, times, dates and flags are dropped rather than half-filled", () => {
  const r = parseKitReading({
    kit_year: "2026",
    logistics: {
      ...blank(KIT_LOGISTICS_FIELDS),
      timezone: v("PST"),
      advance_cutoff_local: v("3:30 PM"),
      direct_cutoff_local: v("noonish"),
      targeted_move_in: v("maybe"),
      gsc_url: v("freemanco.com/store"),
    },
    facts: { ...blank(KIT_SHOW_FACTS), show_start_date: v("Nov 3"), move_in_start: v("2026-10-30") },
    warnings: [],
  });
  assert.ok(r);
  assert.equal(r.logistics.timezone, undefined);
  assert.equal(r.logistics.advance_cutoff_local?.value, "15:30");
  assert.equal(r.logistics.direct_cutoff_local, undefined);
  assert.equal(r.logistics.targeted_move_in, undefined);
  assert.equal(r.logistics.gsc_url?.value, "https://freemanco.com/store");
  assert.equal(r.facts.show_start_date, undefined);
  assert.equal(r.facts.move_in_start?.value, "2026-10-30");
});

test("a good timezone and yes/no flag come through", () => {
  const r = parseKitReading({
    kit_year: "",
    logistics: { ...blank(KIT_LOGISTICS_FIELDS), timezone: v("America/Los_Angeles"), targeted_move_in: v("Yes") },
    facts: blank(KIT_SHOW_FACTS),
    warnings: [],
  });
  assert.equal(r?.logistics.timezone?.value, "America/Los_Angeles");
  assert.equal(r?.logistics.targeted_move_in?.value, "yes");
});

test("garbage is not a reading", () => {
  assert.equal(parseKitReading(null), null);
  assert.equal(parseKitReading("hello"), null);
});

test("normalizeTime", () => {
  assert.equal(normalizeTime("15:30"), "15:30");
  assert.equal(normalizeTime("3:30 pm"), "15:30");
  assert.equal(normalizeTime("12:00 AM"), "00:00");
  assert.equal(normalizeTime("12:00 p.m."), "12:00");
  assert.equal(normalizeTime("0800"), "08:00");
  assert.equal(normalizeTime("25:00"), null);
  assert.equal(normalizeTime("close of business"), null);
});

test("htmlToText keeps words and links, drops scripts", () => {
  const t = htmlToText(
    '<html><head><title>x</title></head><body><script>var a=1</script><p>Ship to <a href="https://x.com/w">Freeman</a></p><p>Deadline&nbsp;Oct 1</p></body></html>',
  );
  assert.ok(t.includes("Ship to Freeman (https://x.com/w)"));
  assert.ok(t.includes("Deadline Oct 1"));
  assert.ok(!t.includes("var a"));
});

test("only public web addresses can be fetched", () => {
  assert.ok(isFetchableUrl("https://www.freemanco.com/kit.pdf"));
  assert.ok(!isFetchableUrl("http://localhost:3000/"));
  assert.ok(!isFetchableUrl("http://169.254.169.254/latest/meta-data"));
  assert.ok(!isFetchableUrl("http://[::1]/"));
  assert.ok(!isFetchableUrl("file:///etc/passwd"));
  assert.ok(!isFetchableUrl("https://user:pw@example.com/"));
  assert.ok(!isFetchableUrl("http://intranet/"));
  assert.ok(!isFetchableUrl("not a url"));
});

test("compareFacts flags mismatches and gaps, and matches addresses loosely", () => {
  const out = compareFacts(
    {
      show_start_date: v("2026-11-03"),
      move_in_start: v("2026-10-30"),
      advance_warehouse_open: v("2026-10-01"),
      advance_warehouse_address: v("Freeman c/o SEMA Show, 6285 S. Polaris Ave, Las Vegas, NV 89118"),
    },
    {
      show_start_date: "2026-11-03",
      move_in_start: "2026-10-29",
      advance_warehouse_open: null,
      advance_warehouse_address: "SEMA Show, C/O Freeman, 6285 Polaris Avenue, Las Vegas, NV 89118",
    },
  );
  const by = Object.fromEntries(out.map((f) => [f.field, f.status]));
  assert.equal(by.show_start_date, "same");
  assert.equal(by.move_in_start, "differs");
  assert.equal(by.advance_warehouse_open, "missing");
  assert.equal(by.advance_warehouse_address, "same");
});

test("compareFacts catches a different street", () => {
  const [f] = compareFacts(
    { direct_to_show_address: v("3150 Paradise Rd, Las Vegas, NV 89109") },
    { direct_to_show_address: "1 Main St, Las Vegas, NV 89109" },
  );
  assert.equal(f.status, "differs");
});
