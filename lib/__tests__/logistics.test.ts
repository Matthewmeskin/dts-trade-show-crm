import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveStatus,
  goesStaleOn,
  isValidSlug,
  publishBlockers,
  slugify,
  verifyBlockers,
  STALE_AFTER_DAYS,
} from "../logistics";

// These rules all mirror something the database enforces. The tests exist because
// the UI uses the copies to decide what to show BEFORE the database gets a say, so
// a drift between the two turns into a button that lies.

const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};
const daysAhead = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const upcoming = daysAhead(30);
const pastShow = "2020-01-05";

test("no logistics row means no page", () => {
  assert.equal(effectiveStatus(null, upcoming), "none");
});

test("a draft stays a draft whatever its dates", () => {
  assert.equal(
    effectiveStatus(
      { verification_status: "draft", last_verified_at: daysAgo(1) },
      upcoming,
    ),
    "draft",
  );
});

test("verified inside the window is verified", () => {
  assert.equal(
    effectiveStatus(
      { verification_status: "verified", last_verified_at: daysAgo(5) },
      upcoming,
    ),
    "verified",
  );
});

test(`verified more than ${STALE_AFTER_DAYS} days ago goes stale on its own`, () => {
  assert.equal(
    effectiveStatus(
      { verification_status: "verified", last_verified_at: daysAgo(STALE_AFTER_DAYS + 1) },
      upcoming,
    ),
    "stale",
  );
});

test("the day before the deadline is still fresh", () => {
  assert.equal(
    effectiveStatus(
      { verification_status: "verified", last_verified_at: daysAgo(STALE_AFTER_DAYS - 1) },
      upcoming,
    ),
    "verified",
  );
});

test("a show that already happened never goes stale", () => {
  // History is not a liability: otherwise every archived edition starts shouting a
  // warning 60 days after the show and the archive fills with noise.
  assert.equal(
    effectiveStatus(
      { verification_status: "verified", last_verified_at: daysAgo(900) },
      pastShow,
    ),
    "verified",
  );
});

test("verified with no timestamp is treated as stale, not fresh", () => {
  assert.equal(
    effectiveStatus({ verification_status: "verified", last_verified_at: null }, upcoming),
    "stale",
  );
});

test("goesStaleOn is 60 days after the check, and null when not verified", () => {
  const at = "2027-01-01T00:00:00.000Z";
  const due = goesStaleOn({ verification_status: "verified", last_verified_at: at });
  assert.equal(due?.toISOString().slice(0, 10), "2027-03-02"); // Jan 1 + 60 days
  assert.equal(goesStaleOn({ verification_status: "draft", last_verified_at: at }), null);
  assert.equal(goesStaleOn(null), null);
});

const completeShow = {
  show_start_date: upcoming,
  show_end_date: upcoming,
  advance_warehouse_name: "Sample Warehouse",
  advance_warehouse_street1: "500 Sample Rd",
  direct_to_show_street1: null,
  advance_warehouse_address: null,
  direct_to_show_address: null,
  series_id: "11111111-1111-1111-1111-111111111111",
};
const completeDraft = {
  timezone: "America/Chicago",
  source_url: "https://example.invalid/kit",
  source_type: "official_kit",
};

test("a complete row has nothing blocking verification", () => {
  assert.deepEqual(verifyBlockers(completeShow, completeDraft), []);
});

test("verify needs a source URL and a source type", () => {
  const fields = verifyBlockers(completeShow, {
    ...completeDraft,
    source_url: null,
    source_type: null,
  }).map((b) => b.field);
  assert.deepEqual(fields, ["source_url", "source_type"]);
});

test("verify needs a timezone, because a date without one is ambiguous", () => {
  const blockers = verifyBlockers(completeShow, { ...completeDraft, timezone: null });
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].field, "timezone");
  assert.equal(blockers[0].fix, "logistics");
});

test("verify needs show dates", () => {
  const fields = verifyBlockers(
    { ...completeShow, show_start_date: null, show_end_date: null },
    completeDraft,
  ).map((b) => b.field);
  assert.deepEqual(fields, ["show_dates"]);
});

test("a direct-to-show street alone is enough — no advance warehouse required", () => {
  assert.deepEqual(
    verifyBlockers(
      {
        ...completeShow,
        advance_warehouse_name: null,
        advance_warehouse_street1: null,
        direct_to_show_street1: "1 Sample Hall Dr",
      },
      completeDraft,
    ),
    [],
  );
});

test("a warehouse name with no street is not enough", () => {
  const fields = verifyBlockers(
    { ...completeShow, advance_warehouse_street1: null },
    completeDraft,
  ).map((b) => b.field);
  assert.deepEqual(fields, ["freight_address"]);
});

test("a legacy one-line address says to split it, rather than just refusing", () => {
  const blockers = verifyBlockers(
    {
      ...completeShow,
      advance_warehouse_name: null,
      advance_warehouse_street1: null,
      advance_warehouse_address: "500 Sample Rd, Sampleville, IL 60602",
    },
    completeDraft,
  );
  assert.equal(blockers.length, 1);
  assert.match(blockers[0].message, /Split it/);
});

test("an unattached edition has no URL, so it cannot publish", () => {
  const blockers = publishBlockers({ ...completeShow, series_id: null }, null);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].field, "series");
});

test("an attached but unpublished show reports only that", () => {
  const series = {
    id: completeShow.series_id,
    slug: "sample-expo",
    name: "Sample Expo",
    is_public: false,
    description_short: null,
    industry: null,
    typical_city: null,
    typical_month: null,
    created_at: "",
    updated_at: "",
  };
  const blockers = publishBlockers(completeShow, series);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].field, "is_public");
  assert.deepEqual(publishBlockers(completeShow, { ...series, is_public: true }), []);
});

test("slugify produces something the database will accept", () => {
  assert.equal(slugify("IFT FIRST"), "ift-first");
  assert.equal(slugify("PRI Show (Performance Racing Industry Show)"), "pri-show-performance-racing-industry-show");
  assert.equal(slugify("  Pack Expo — 2027!  "), "pack-expo-2027");
  assert.equal(slugify("A&B  Expo"), "a-b-expo");
  for (const name of ["IFT FIRST", "PRI Show (x)", "A&B  Expo", "Expo 2027"]) {
    assert.ok(isValidSlug(slugify(name)), `${name} -> ${slugify(name)}`);
  }
});

test("isValidSlug matches the slug_is_url_shaped constraint", () => {
  assert.ok(isValidSlug("ift-first"));
  assert.ok(isValidSlug("expo2027"));
  assert.ok(!isValidSlug("IFT-First"), "no uppercase");
  assert.ok(!isValidSlug("-leading"), "no leading hyphen");
  assert.ok(!isValidSlug("trailing-"), "no trailing hyphen");
  assert.ok(!isValidSlug("double--hyphen"), "no doubled hyphen");
  assert.ok(!isValidSlug("has space"), "no spaces");
  assert.ok(!isValidSlug(""), "not empty");
});
