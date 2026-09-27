import { test } from "node:test";
import assert from "node:assert/strict";
import { syncHealth, type SyncRun } from "../sync-health";

// The alert has to fire when the public pages stop updating, and not fire on a
// single blip or flood the inbox while it stays broken.

const at = (iso: string) => new Date(iso);
const run = (ran_at: string, ok: boolean, error: string | null = null): SyncRun => ({ ran_at, trigger: "schedule", ok, error });

test("healthy, and one failed run heals without an alert", () => {
  const now = at("2026-09-27T18:05:00Z");
  assert.equal(syncHealth([run("2026-09-27T18:00:00Z", true)], now).status, "ok");
  const blip = syncHealth([run("2026-09-27T18:00:00Z", false, "timeout"), run("2026-09-27T17:45:00Z", true)], now);
  assert.equal(blip.status, "ok");
  assert.equal(blip.alert, false);
  assert.equal(blip.consecutiveFailures, 1);
});

test("two failures in a row alert on the first hourly check, then every 4 hours", () => {
  const runs = [
    run("2026-09-27T18:15:00Z", false, "apply_export_signed 401: not authorized"),
    run("2026-09-27T18:00:00Z", false, "apply_export_signed 401: not authorized"),
    run("2026-09-27T17:45:00Z", true),
  ];
  const first = syncHealth(runs, at("2026-09-27T19:00:00Z"));
  assert.equal(first.status, "failing");
  assert.equal(first.badSince, "2026-09-27T18:15:00Z");
  assert.equal(first.alert, true);
  assert.equal(first.lastOkAt, "2026-09-27T17:45:00Z");
  assert.match(first.subject, /failing \(2 runs in a row\)/);
  assert.match(first.html, /not authorized/);
  // Later checks: quiet at +1h..+3h, again at +4h.
  const later = (h: number) => syncHealth(runs, new Date(at("2026-09-27T19:00:00Z").getTime() + h * 3600_000)).alert;
  assert.deepEqual([1, 2, 3, 4].map(later), [false, false, false, true]);
});

test("a cron that stopped altogether is caught after 45 quiet minutes", () => {
  const runs = [run("2026-09-27T18:00:00Z", true)];
  assert.equal(syncHealth(runs, at("2026-09-27T18:40:00Z")).status, "ok");
  const quiet = syncHealth(runs, at("2026-09-27T19:00:00Z"));
  assert.equal(quiet.status, "quiet");
  assert.equal(quiet.alert, true);
  assert.match(quiet.subject, /stopped running/);
});

test("no runs yet is reported but doesn't alert", () => {
  const h = syncHealth([], at("2026-09-27T18:00:00Z"));
  assert.equal(h.status, "never");
  assert.equal(h.alert, false);
});
