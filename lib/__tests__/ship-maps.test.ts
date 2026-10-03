import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPathname, validMapPathname, validMapUrl } from "../ship-maps";

const P = "11111111-2222-3333-4444-555555555555";
const S = "66666666-7777-8888-9999-000000000000";

test("a map link is https and nothing else, as the database checks", () => {
  assert.ok(validMapUrl("https://example.com/sample-expo/floor-plan.pdf"));
  assert.ok(!validMapUrl("http://example.com/floor-plan.pdf"));
  assert.ok(!validMapUrl("javascript:alert(1)"));
  assert.ok(!validMapUrl("https://example.com/a b.pdf"));
  assert.ok(!validMapUrl('https://example.com/"><script>'));
  assert.ok(!validMapUrl(`https://example.com/${"a".repeat(1000)}`));
});

test("uploads go to one folder per GSC and show, named for the map", () => {
  assert.equal(mapPathname(P, S, "floor_plan", "application/pdf"), `ship-maps/${P}/${S}/floor-plan.pdf`);
  assert.equal(mapPathname(P, S, "dock_map", "image/jpeg"), `ship-maps/${P}/${S}/dock-map.jpg`);
  assert.equal(mapPathname(P, S, "dock_map", "image/gif"), null);
  assert.equal(mapPathname("../x", S, "dock_map", "image/png"), null);
});

test("the upload route signs only paths it could have made", () => {
  assert.ok(validMapPathname(`ship-maps/${P}/${S}/floor-plan.pdf`));
  assert.ok(!validMapPathname(`ship-maps/${P}/${S}/../../logo.png`));
  assert.ok(!validMapPathname(`logos/${P}.png`));
  assert.ok(!validMapPathname(`ship-maps/${P}/${S}/floor-plan.html`));
});
