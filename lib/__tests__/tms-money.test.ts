import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMoney, parseLoad } from "../tms";

// A Hyperion GetLoads load carries money in TWO arrays with different keys:
//   items[]        base freight — `billed` / `cost`
//   accessorials[] surcharges   — `bill` / `cost`
// The total must include every line from both, not just the first freight line.

test("loadMoney sums base freight + all accessorials", () => {
  const load = {
    loadId: 1,
    items: [{ billed: 288.25, cost: 200 }],
    accessorials: [
      { bill: 106, cost: 70, code: "LGDE" },
      { bill: 195, cost: 150, code: "TSPK" },
      { bill: 35.75, cost: 27.5, code: "" },
    ],
  };
  const m = loadMoney(load);
  assert.equal(m.billed, 625); // 288.25 + 106 + 195 + 35.75
  assert.equal(m.cost, 447.5); // 200 + 70 + 150 + 27.5
});

test("loadMoney sums multiple freight lines", () => {
  const load = {
    loadId: 2,
    items: [
      { billed: 142.29, cost: 134.63 },
      { billed: 105, cost: 55 },
    ],
    accessorials: [{ bill: 235.03, cost: 152, code: "FUEL" }],
  };
  const m = loadMoney(load);
  assert.equal(m.billed, 482.32); // 142.29 + 105 + 235.03
  assert.equal(m.cost, 341.63); // 134.63 + 55 + 152
});

test("loadMoney prefers the line sum over a top-level scalar", () => {
  // Hyperion's top-level `billed`/`value` reflects only the first line — the
  // per-line sum must win so accessorials aren't dropped.
  const load = {
    loadId: 3,
    billed: 288.25,
    value: 288.25,
    items: [{ billed: 288.25, cost: 200 }],
    accessorials: [{ bill: 106, cost: 70, code: "LGDE" }],
  };
  const m = loadMoney(load);
  assert.equal(m.billed, 394.25); // NOT 288.25
});

test("loadMoney falls back to a top-level scalar when no line detail exists", () => {
  const m = loadMoney({ loadId: 4, billed: 500, cost: 400 });
  assert.equal(m.billed, 500);
  assert.equal(m.cost, 400);
});

test("loadMoney returns undefined when a load carries no money at all", () => {
  const m = loadMoney({ loadId: 5, totalWeight: 1000, totalPieces: 3 });
  assert.equal(m.billed, undefined);
  assert.equal(m.cost, undefined);
});

test("parseLoad writes the full billed/cost total onto the shipment", () => {
  const parsed = parseLoad({
    clientLoadId: 42,
    items: [{ billed: 288.25, cost: 200 }],
    accessorials: [
      { bill: 106, cost: 70, code: "LGDE" },
      { bill: 195, cost: 150, code: "TSPK" },
    ],
  });
  assert.equal(parsed?.fields.billed_amount, 589.25);
  assert.equal(parsed?.fields.cost_amount, 420);
});
