import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAction, actionState, startCallDate, emailTeamDate, weekBeforeDate } from "../sales";

const today = "2026-09-24";

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

test("next action walks the steps: start call, then email, then the show", () => {
  const show = { show_start_date: "2026-11-23", lead_gen_start_date: null, emailed_two_weeks: false };
  assert.deepEqual(nextAction(show, today), { kind: "start_call", label: "Start calling", date: "2026-09-24", state: "due_soon", daysOut: 0 });
  const calling = { ...show, lead_gen_start_date: "2026-09-24" };
  const a = nextAction(calling, today);
  assert.equal(a?.kind, "email_team");
  assert.equal(a?.date, "2026-11-09");
  assert.equal(a?.state, "later");
  const emailed = { ...calling, emailed_two_weeks: true };
  assert.equal(nextAction(emailed, today)?.kind, "show");
});

test("an unsent two-week email past its date points at the week-before cutoff", () => {
  const show = { show_start_date: "2026-10-05", lead_gen_start_date: "2026-08-01", emailed_two_weeks: false };
  // email was due Sep 21; week-before is Sep 28, still ahead
  const a = nextAction(show, today);
  assert.equal(a?.kind, "week_before");
  assert.equal(a?.date, "2026-09-28");
  assert.equal(a?.state, "due_soon");
});

test("an unsent email past even the week-before cutoff is overdue on the email step", () => {
  const show = { show_start_date: "2026-09-28", lead_gen_start_date: "2026-08-01", emailed_two_weeks: false };
  const a = nextAction(show, today);
  assert.equal(a?.kind, "email_team");
  assert.equal(a?.state, "overdue");
  assert.equal(a?.daysOut, -10);
});

test("a show that has opened has nothing left, and a show with no date has no action", () => {
  assert.equal(nextAction({ show_start_date: "2026-09-01", lead_gen_start_date: null, emailed_two_weeks: false }, today)?.state, "done");
  assert.equal(nextAction({ show_start_date: null, lead_gen_start_date: null, emailed_two_weeks: false }, today), null);
});
