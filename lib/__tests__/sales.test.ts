import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAction, actionState, startCallDate, emailTeamDate, weekBeforeDate, parseReps, joinReps } from "../sales";

const today = "2026-09-24";
const base = { lead_gen_start_date: null, emailed_two_weeks: false, week_before_sent: false };

test("milestone dates count back from the show start", () => {
  assert.equal(startCallDate("2026-11-23"), "2026-09-24");
  assert.equal(emailTeamDate("2026-11-23"), "2026-11-09");
  assert.equal(weekBeforeDate("2026-11-23"), "2026-11-16");
});

test("state: overdue before today, due soon within a week, later after", () => {
  assert.equal(actionState("2026-09-23", today), "overdue");
  assert.equal(actionState("2026-09-24", today), "due_soon");
  assert.equal(actionState("2026-10-01", today), "due_soon");
  assert.equal(actionState("2026-10-02", today), "later");
});

test("next action walks the steps: call, email, week-before, then the show", () => {
  const show = { ...base, show_start_date: "2026-11-23" };
  assert.deepEqual(nextAction(show, today), { kind: "start_call", label: "Start calling", date: "2026-09-24", state: "due_soon", daysOut: 0 });
  const calling = { ...show, lead_gen_start_date: "2026-09-24" };
  assert.equal(nextAction(calling, today)?.kind, "email_team");
  assert.equal(nextAction(calling, today)?.date, "2026-11-09");
  const emailed = { ...calling, emailed_two_weeks: true };
  assert.equal(nextAction(emailed, today)?.kind, "week_before");
  assert.equal(nextAction(emailed, today)?.date, "2026-11-16");
  const all = { ...emailed, week_before_sent: true };
  assert.equal(nextAction(all, today)?.kind, "show");
});

test("an unsent step stays on the list as overdue instead of rolling forward", () => {
  const show = { ...base, show_start_date: "2026-10-05", lead_gen_start_date: "2026-08-01" };
  const a = nextAction(show, today);
  assert.equal(a?.kind, "email_team");
  assert.equal(a?.state, "overdue");
  assert.equal(a?.daysOut, -3);
});

test("a show that has opened has nothing left, and a show with no date has no action", () => {
  assert.equal(nextAction({ ...base, show_start_date: "2026-09-01" }, today)?.state, "done");
  assert.equal(nextAction({ ...base, show_start_date: null }, today), null);
});

test("reps parse out of the free-text field however it was typed", () => {
  assert.deepEqual(parseReps("Kevin, Yves, Jean"), ["Kevin", "Yves", "Jean"]);
  assert.deepEqual(parseReps("Jean & Jaena"), ["Jean", "Jaena"]);
  assert.deepEqual(parseReps("Jasmine and  Nadine"), ["Jasmine", "Nadine"]);
  assert.deepEqual(parseReps("kevin, Kevin"), ["kevin"]);
  assert.deepEqual(parseReps("No sales rep yet"), []);
  assert.deepEqual(parseReps(null), []);
  assert.equal(joinReps(["Kevin", "", "Yves"]), "Kevin, Yves");
  assert.equal(joinReps([]), null);
});
