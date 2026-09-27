import { test } from "node:test";
import assert from "node:assert/strict";
import { slugsOf, SHOW_EXPORT_SIG, PARTNER_EXPORT_SIG } from "../public-sync";

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

test("the column signatures match the reviewed export views", () => {
  // If an export view changes, these change on purpose - after review - and the
  // public project's apply functions refuse anything else.
  assert.equal(SHOW_EXPORT_SIG, "69e2b14b62548958d3acd661eaf52c24");
  assert.equal(PARTNER_EXPORT_SIG, "0f6087d487a0bcffd359f1d01ddf095d");
});
