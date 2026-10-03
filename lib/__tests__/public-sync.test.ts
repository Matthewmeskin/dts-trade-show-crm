import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  slugsOf,
  showExportSig,
  SHOW_EXPORT_SIG,
  SHOW_EXPORT_SIG_BEFORE_FLAGS,
  PARTNER_EXPORT_SIG,
  SHIP_EXPORT_SIG,
  SHIP_EXPORT_SIG_BEFORE_MAPS,
  shipExportSig,
} from "../public-sync";

test("revalidation covers every show and every cobranded show, once each", () => {
  assert.deepEqual(
    slugsOf(
      [{ slug: "sema", year: 2026 }, { slug: "sema", year: 2027 }, { slug: "aapex" }],
      [{ partner_code: "acme", show_slug: "sema" }, { partner_code: "acme", show_slug: "g2e" }],
    ),
    ["sema", "aapex", "g2e"],
  );
  assert.deepEqual(slugsOf([], []), []);
});

// The export views' columns, as reviewed (dts-sage trade-show/crm/tests/export_surface.sql).
const SHOW_COLUMNS_BEFORE_FLAGS = [
  "advance_care_of", "advance_city", "advance_country", "advance_cutoff_local",
  "advance_late_surcharge_note", "advance_postal_code", "advance_receiving_deadline",
  "advance_receiving_start", "advance_state", "advance_street", "advance_street2",
  "advance_warehouse_name", "advance_window_text", "carrier_check_in_cutoff_local",
  "carrier_check_in_deadline", "description_short", "direct_care_of", "direct_city",
  "direct_country", "direct_cutoff_local", "direct_delivery_end", "direct_delivery_start",
  "direct_location_name", "direct_postal_code", "direct_state", "direct_street",
  "direct_street2", "direct_window_text", "dts_notes", "dts_notes_updated_at", "end_date",
  "gsc_name", "gsc_url", "industry", "label_requirements_note", "last_verified_at",
  "marshalling_yard_note", "move_in_end", "move_in_schedule_url", "move_in_start",
  "move_out_end", "move_out_start", "name", "official_kit_url", "organizer_name",
  "organizer_url", "slug", "source_edition_id", "source_show_id", "source_type", "source_url",
  "start_date", "targeted_move_in", "targeted_move_in_note", "timezone", "typical_city",
  "typical_month", "venue_address_line", "venue_city", "venue_name", "venue_slug",
  "venue_state", "verification_status", "verified_by", "year",
];
const SHIP_COLUMNS = [
  "coordinator_mobile", "coordinator_name", "display_name", "enabled", "label_settings",
  "logo_url", "partner_code", "partner_id", "request_cap", "ship_email", "ship_phone",
  "source_edition_id", "transit_days",
];
// What the public project computes: md5 of the sorted keys, comma-joined.
const sig = (cols: string[]) => createHash("md5").update([...cols].sort().join(",")).digest("hex");

test("the column signatures match the reviewed export views", () => {
  // If an export view changes, these change on purpose - after review - and the
  // public project's apply functions refuse anything else.
  assert.equal(SHOW_EXPORT_SIG_BEFORE_FLAGS, sig(SHOW_COLUMNS_BEFORE_FLAGS));
  assert.equal(SHOW_EXPORT_SIG, sig([...SHOW_COLUMNS_BEFORE_FLAGS, "is_public", "ship_enabled"]));
  assert.equal(SHIP_EXPORT_SIG_BEFORE_MAPS, sig(SHIP_COLUMNS));
  assert.equal(SHIP_EXPORT_SIG, sig([...SHIP_COLUMNS, "dock_map_url", "floor_plan_url"]));
  assert.equal(PARTNER_EXPORT_SIG, sig(["display_name", "logo_url", "partner_code", "partner_type", "show_slug", "website"]));
});

test("the show signature follows the export actually read, before and after export 008", () => {
  assert.equal(showExportSig([]), null);
  assert.equal(showExportSig([{ slug: "sema" }]), SHOW_EXPORT_SIG_BEFORE_FLAGS);
  assert.equal(showExportSig([{ slug: "sema", is_public: false, ship_enabled: true }]), SHOW_EXPORT_SIG);
});

test("the Shipping Center signature follows the export actually read, before and after export 010", () => {
  assert.equal(shipExportSig([]), null);
  assert.equal(shipExportSig([{ partner_code: "acme" }]), SHIP_EXPORT_SIG_BEFORE_MAPS);
  assert.equal(shipExportSig([{ partner_code: "acme", floor_plan_url: null, dock_map_url: null }]), SHIP_EXPORT_SIG);
});
