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
