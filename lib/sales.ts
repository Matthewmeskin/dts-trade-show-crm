/**
 * Sales / lead-gen pipeline helpers. The key outreach dates are derived from a
 * show's start date (not stored): start-call 60 days out, email-team 2 weeks
 * out, and the "week before" cutoff 1 week out.
 */

export function shiftDays(date: string | null | undefined, days: number): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const startCallDate = (showStart: string | null | undefined) => shiftDays(showStart, -60);
export const emailTeamDate = (showStart: string | null | undefined) => shiftDays(showStart, -14);
export const weekBeforeDate = (showStart: string | null | undefined) => shiftDays(showStart, -7);

export type SalesMilestoneKind =
  | "start_call"
  | "lead_gen_start"
  | "lead_gen_done"
  | "email_team"
  | "week_before"
  | "show";

export type SalesMilestone = {
  showId: string;
  showName: string;
  date: string; // YYYY-MM-DD
  kind: SalesMilestoneKind;
  label: string;
  /** True when this step is already marked complete (greyed in the agenda). */
  done: boolean;
  owner: string | null;
};

export const MILESTONE_META: Record<
  SalesMilestoneKind,
  { label: string; badge: string; dot: string }
> = {
  start_call: { label: "Start calling", badge: "bg-dts-blue/10 text-dts-blue", dot: "bg-dts-blue" },
  lead_gen_start: { label: "Lead gen starts", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  lead_gen_done: { label: "Lead gen done", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  email_team: { label: "Email team (2 wks)", badge: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  week_before: { label: "Week-before cutoff", badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  show: { label: "Show opens", badge: "bg-dts-maroon/10 text-dts-maroon", dot: "bg-dts-maroon" },
};

export type ShowForMilestones = {
  id: string;
  show_name: string;
  show_start_date: string | null;
  lead_gen_owner: string | null;
  lead_gen_start_date: string | null;
  lead_gen_completion_date: string | null;
  emailed_two_weeks: boolean | null;
  week_before_sent?: boolean | null;
  instantly_created: boolean | null;
};

/** All dated sales milestones for one show (skips ones with no date). */
export function showMilestones(s: ShowForMilestones): SalesMilestone[] {
  const base = { showId: s.id, showName: s.show_name, owner: s.lead_gen_owner ?? null };
  const out: (SalesMilestone | null)[] = [
    s.show_start_date ? { ...base, date: startCallDate(s.show_start_date)!, kind: "start_call", label: MILESTONE_META.start_call.label, done: false } : null,
    s.lead_gen_start_date ? { ...base, date: s.lead_gen_start_date.slice(0, 10), kind: "lead_gen_start", label: MILESTONE_META.lead_gen_start.label, done: !!s.lead_gen_completion_date } : null,
    s.lead_gen_completion_date ? { ...base, date: s.lead_gen_completion_date.slice(0, 10), kind: "lead_gen_done", label: MILESTONE_META.lead_gen_done.label, done: true } : null,
    s.show_start_date ? { ...base, date: emailTeamDate(s.show_start_date)!, kind: "email_team", label: MILESTONE_META.email_team.label, done: !!s.emailed_two_weeks } : null,
    s.show_start_date ? { ...base, date: weekBeforeDate(s.show_start_date)!, kind: "week_before", label: MILESTONE_META.week_before.label, done: false } : null,
    s.show_start_date ? { ...base, date: s.show_start_date.slice(0, 10), kind: "show", label: MILESTONE_META.show.label, done: false } : null,
  ];
  return out.filter((m): m is SalesMilestone => m !== null);
}

export type ActionState = "overdue" | "due_soon" | "later" | "done" | "none";

export type NextAction = {
  kind: SalesMilestoneKind;
  label: string;
  date: string; // YYYY-MM-DD
  state: ActionState;
  /** Whole days from today; negative when overdue. */
  daysOut: number;
};

const DUE_SOON_DAYS = 7;

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function actionState(date: string, today: string): Exclude<ActionState, "done" | "none"> {
  const d = daysBetween(today, date);
  if (d < 0) return "overdue";
  if (d <= DUE_SOON_DAYS) return "due_soon";
  return "later";
}

/**
 * The one thing to do next on a show, so the calendar reads as a worklist.
 *
 * Steps in order, each with its own done-mark: start calling (the lead-gen
 * start date is set), email the team at two weeks (the "sent" box), the
 * week-before outreach (its "sent" box), then the show itself. A step stays
 * on the list until it is marked, so an unsent email shows as overdue rather
 * than quietly rolling to the next step. A show that has opened has nothing
 * left to do here.
 */
export function nextAction(
  s: Pick<ShowForMilestones, "show_start_date" | "lead_gen_start_date" | "emailed_two_weeks" | "week_before_sent">,
  today: string,
): NextAction | null {
  if (!s.show_start_date) return null;
  const showDay = s.show_start_date.slice(0, 10);
  if (showDay < today) return { kind: "show", label: "Show has opened", date: showDay, state: "done", daysOut: daysBetween(today, showDay) };

  const steps: { kind: SalesMilestoneKind; date: string; done: boolean }[] = [
    { kind: "start_call", date: startCallDate(showDay)!, done: !!s.lead_gen_start_date },
    { kind: "email_team", date: emailTeamDate(showDay)!, done: !!s.emailed_two_weeks },
    { kind: "week_before", date: weekBeforeDate(showDay)!, done: !!s.week_before_sent },
  ];
  for (const step of steps) {
    if (step.done) continue;
    return { kind: step.kind, label: MILESTONE_META[step.kind].label, date: step.date, state: actionState(step.date, today), daysOut: daysBetween(today, step.date) };
  }
  return { kind: "show", label: MILESTONE_META.show.label, date: showDay, state: actionState(showDay, today), daysOut: daysBetween(today, showDay) };
}

/** The steps a person can mark done from the calendar, and what marking does. */
export const COMPLETABLE_STEPS = ["start_call", "email_team", "week_before"] as const;
export type CompletableStep = (typeof COMPLETABLE_STEPS)[number];

const NO_REP = /^\s*(no|none|tbd|n\/a)\b.*rep/i;

/**
 * Sales reps are stored as one free-text field ("Kevin, Yves, Jean") that the
 * old sheet carried over. Parse it into names so the calendar can offer a
 * pick-list, filter by rep, and count shows with nobody on them, without a
 * schema change the Overview form would also have to learn.
 */
export function parseReps(value: string | null | undefined): string[] {
  if (!value || NO_REP.test(value)) return [];
  const out: string[] = [];
  for (const raw of value.split(/[,;/&]|\band\b/i)) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (!out.some((n) => n.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

export function joinReps(names: string[]): string | null {
  const clean = parseReps(names.join(", "));
  return clean.length ? clean.join(", ") : null;
}
