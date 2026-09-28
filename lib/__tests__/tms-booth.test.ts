import { test } from "node:test";
import assert from "node:assert/strict";
import { boothForSync, boothFrom, parseBooth } from "../tms";

test("the TMS sync fills a booth only onto a shipment that has none", () => {
  assert.equal(boothForSync("1203", null), "1203");
  assert.equal(boothForSync("1203", ""), "1203");
  assert.equal(boothForSync("1203", "  "), "1203");
  // Typed in on the shipment (or from a Shipping Center request): kept.
  assert.equal(boothForSync("1203", "1203A"), undefined);
  // Nothing parsed from the stop notes: nothing written, the typed booth stays.
  assert.equal(boothForSync(undefined, "1203A"), undefined);
  assert.equal(boothForSync(undefined, null), undefined);
});

// Shapes seen on real loads (Sept 2026), with the booth each should give.
const SEEN: [string, string | undefined][] = [
  ["900 E Market St Booth: 1219, San Antonio, TX 78205", "1219"],
  ["300 Convention Center Dr Booth: N7025 - North Hall, Las Vegas, NV", "N7025"],
  ["3150 Paradise Rd BOOTH#: N15300,  Las Vegas, NV", "N15300"],
  ["9800 International Dr Booth: W3183,  Orlando, FL", "W3183"],
  ["Columbus Convention Center Booth#: 811,  Columbus, OH", "811"],
  ["2899 Dowd Drive Booth#: N-6648,  Santa Rosa, CA", "N-6648"],
  ["6675 W Sunset Rd Booth#: 12677 , Las Vegas, NV", "12677"],
  ["PCI-SIG (booth #3118)", "3118"],
  ["Booth#839", "839"],
  ["Booth # 500,502", "500, 502"],
  ["BOOTH# 112", "112"],
  ["Vikan Booth#221", "221"],
  ["Booth No# 3810", "3810"],
  ["Booth# 831 P", "831"],
  ["booth number 12a", "12A"],
  ["Rockwool - Booths #1751 , Boston, MA", "1751"],
  ["Booth - 617", "617"],
  ["Marshalling Yard for Booth numbers 22813/22913, Las Vegas", "22813, 22913"],
  ["Sample Marine - Booth #TBD,  Orlando, FL", undefined],
  ["Sample Running, Booth # tbd 2866 McDowell St", undefined],
  ["Paradise Rd Booth#: ???,  Las Vegas, NV", undefined],
  ["Shore Drive Booth: South Building, Level 2", undefined],
  ["Booth#: not available ,  Florence", undefined],
  ["10088 General Dr Booth#: C/O Brava Roof Tile", undefined],
  ["LAST NIGHT GAMES - Booth #LAST 2, Columbus, OH", undefined],
  ["Security Expo / ALLEGION BOOTH, Denver, CO 80237", undefined],
  ["Boothbay Harbor, ME 04538", undefined],
];

test("a booth comes out of the ways people actually write it", () => {
  for (const [text, booth] of SEEN) assert.equal(parseBooth(text), booth, text);
});

test("the stops come first, then the references and notes", () => {
  assert.equal(boothFrom(undefined, "Hall B Booth: 1203, Chicago", "Booth 99"), "1203");
  assert.equal(boothFrom(undefined, "1 Sample Way, Chicago", null, "Booth# 4412"), "4412");
  assert.equal(boothFrom("1 Sample Way", null, "PO 55123"), undefined);
});

// Real snippets, with what the Postgres form of the pattern gave for each when it
// backfilled older loads (Sept 28 2026). The two must agree.
const BACKFILL: [string, string | null][] = [
  [" Booth#: \t5349,  Las Vegas, NV 89119", "5349"],
  [" Booth#: #4407,  Atlanta, GA 30313", "4407"],
  [" Booth#: 537/539 c/o Securam Systems", "537, 539"],
  [" Booth: 1131 - 1133, Orlando, FL 32837", "1131"],
  ["Booth#s: A4101 & 22013", "A4101, 22013"],
  [" Booth #s, 7971 & 5947, Las Vegas, NV 89118", "7971, 5947"],
  ["booth#s 817 & 3118", "817, 3118"],
  [" Booth: #: 1820, Kansas City, MO 64105", "1820"],
  ["booth # - C2347", "C2347"],
  [" Booth - Arsenal # M-12,  Shreveport, LA", null],
  [" Booth # NUU #447, Gilbert, AZ 85233", null],
  ["Booth#:  A-J — 6547", null],
  [" Booth#:SL-10035 c/o Elevation Packaging", "SL-10035"],
  ["BOOTH NO# 9003", "9003"],
  [" booth number  19131 201 Sands Ave", "19131"],
  ["(BOOTH NUMBER 2) -  8432 SUNSTATE STREET", "2"],
  ["booth number AA-117", "AA-117"],
  [" Booth #TBD,  Orlando, FL 32819", null],
  [" Booth # tbd 2866 McDowell Street", null],
  [" booth hill road, Shelton, CT 06484", null],
  [" Booth#: C/O Brava Roof Tile", null],
  ["Booth: South Building, Level 3 — 339166", null],
  [" Booth # SL 18028, Las Vegas", null],
  [" Booth#: XXX C/O Vercel", null],
  ["Booth #: 171 (WH C/O TForce)", "171"],
  [" booth 617 West & Rheon Booth 1601 West", "617"],
  ["Booth 1951, 1851", "1951, 1851"],
  [" Booth, Lake Buena Vista, FL 32830", null],
  [" Booth#: || ABF Warehouse", null],
  ["Booth: ____", null],
  ["BOOTH # K36", "K36"],
  ["Booth# W-51010", "W-51010"],
  [" Booth#:  23131, Las Vegas, NV 89118", "23131"],
  [" Booth No# 3810 Anaheim Convention Center - 80", "3810"],
  ["Booth#: 2329 - Level 1", "2329"],
  [" Booth#: 2118  LV Convention Center Halls s1-s4", "2118"],
  [" Booth: 417 2301 S Martin Luther King Jr Dr", "417"],
  [" Booth#: 7369 North Hall", "7369"],
  ["Booths #1751", "1751"],
  [" Booth#: ,  Chicago, IL 60616", null],
  [" Booth: North Hall Exhibits — N-6181", null],
  ["Booth#: 41262 - Venetian Expo", "41262"],
];

test("the parser agrees with the Postgres pattern that backfilled older loads", () => {
  for (const [text, booth] of BACKFILL) assert.equal(parseBooth(text) ?? null, booth, text);
});
