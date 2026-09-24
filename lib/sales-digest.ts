import { nextAction, parseReps, type ShowForMilestones, type NextAction } from "@/lib/sales";
import { formatDate, formatDateRange } from "@/lib/format";

/**
 * The Monday email: what the sales calendar would show if someone opened it,
 * delivered instead. Built from the same nextAction() the page uses, so the
 * two never disagree about what is due.
 */

export type DigestShow = ShowForMilestones & {
  show_end_date: string | null;
  edition_year: number | null;
  sales_people: string | null;
};

export type DigestItem = {
  showId: string;
  showName: string;
  editionYear: number | null;
  showDates: string;
  action: NextAction;
  owner: string | null;
  reps: string[];
  url: string;
};

export type Digest = {
  subject: string;
  counts: { overdue: number; dueSoon: number; noRep: number; upcoming: number };
  overdue: DigestItem[];
  dueSoon: DigestItem[];
  noRep: DigestItem[];
  html: string;
};

const CRM = "https://dts-crm-test.vercel.app";

function item(s: DigestShow, action: NextAction): DigestItem {
  return {
    showId: s.id,
    showName: s.show_name,
    editionYear: s.edition_year,
    showDates: formatDateRange(s.show_start_date, s.show_end_date),
    action,
    owner: s.lead_gen_owner,
    reps: parseReps(s.sales_people),
    url: `${CRM}/shows/${s.id}`,
  };
}

export function buildDigest(shows: DigestShow[], today: string): Digest {
  const upcoming = shows.filter((s) => s.show_start_date && (s.show_end_date ?? s.show_start_date)! >= today);
  const withAction = upcoming
    .map((s) => ({ s, a: nextAction(s, today) }))
    .filter((x): x is { s: DigestShow; a: NextAction } => !!x.a && x.a.state !== "done");
  const byDate = (x: { a: NextAction }, y: { a: NextAction }) => x.a.date.localeCompare(y.a.date);
  const overdue = withAction.filter((x) => x.a.state === "overdue").sort(byDate).map((x) => item(x.s, x.a));
  const dueSoon = withAction.filter((x) => x.a.state === "due_soon").sort(byDate).map((x) => item(x.s, x.a));
  const noRep = withAction
    .filter((x) => parseReps(x.s.sales_people).length === 0)
    .sort((x, y) => (x.s.show_start_date ?? "").localeCompare(y.s.show_start_date ?? ""))
    .map((x) => item(x.s, x.a));
  const counts = { overdue: overdue.length, dueSoon: dueSoon.length, noRep: noRep.length, upcoming: upcoming.length };
  const subject = counts.overdue
    ? `Sales calendar: ${counts.overdue} overdue, ${counts.dueSoon} due this week`
    : counts.dueSoon
      ? `Sales calendar: ${counts.dueSoon} due this week`
      : `Sales calendar: nothing due this week (${counts.upcoming} upcoming shows)`;
  return { subject, counts, overdue, dueSoon, noRep, html: renderHtml({ subject, counts, overdue, dueSoon, noRep, today }) };
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function when(a: NextAction): string {
  if (a.daysOut === 0) return "today";
  if (a.daysOut < 0) return `${-a.daysOut} day${a.daysOut === -1 ? "" : "s"} overdue`;
  return `in ${a.daysOut} day${a.daysOut === 1 ? "" : "s"}`;
}

function rows(items: DigestItem[], tone: string): string {
  if (!items.length) return `<p style="margin:4px 0 0;color:#8A929C;font-size:13px">None.</p>`;
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:6px">${items
    .map(
      (i) => `<tr>
  <td style="padding:7px 8px 7px 0;border-top:1px solid #E3E7EC;vertical-align:top">
    <a href="${i.url}" style="color:#1A1D21;font-weight:600;text-decoration:none">${esc(i.showName)}${i.editionYear ? ` <span style="color:#8A929C;font-weight:400">${i.editionYear}</span>` : ""}</a>
    <div style="color:#5B6470;font-size:12px">${esc(i.showDates)}${i.owner ? ` · ${esc(i.owner)}` : ""}${i.reps.length ? ` · ${esc(i.reps.join(", "))}` : ' · <span style="color:#B45309">no sales rep</span>'}</div>
  </td>
  <td style="padding:7px 0;border-top:1px solid #E3E7EC;text-align:right;white-space:nowrap;vertical-align:top;font-size:13px">
    <span style="color:${tone};font-weight:600">${esc(i.action.label)}</span><br>
    <span style="color:#5B6470;font-size:12px">${esc(formatDate(i.action.date))} · ${esc(when(i.action))}</span>
  </td>
</tr>`,
    )
    .join("")}</table>`;
}

function renderHtml(d: { subject: string; counts: Digest["counts"]; overdue: DigestItem[]; dueSoon: DigestItem[]; noRep: DigestItem[]; today: string }): string {
  const section = (title: string, body: string) =>
    `<h2 style="font-size:14px;margin:22px 0 0;color:#1A1D21">${title}</h2>${body}`;
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F7F8FA;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1A1D21">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E3E7EC;border-radius:8px;padding:20px 24px">
  <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#AB0534;font-weight:700">DTS Trade Show CRM</div>
  <h1 style="font-size:18px;margin:4px 0 2px">${esc(d.subject)}</h1>
  <div style="color:#5B6470;font-size:13px">Week of ${esc(formatDate(d.today))} · ${d.counts.upcoming} upcoming shows · <a href="${CRM}/shows/sales" style="color:#AB0534">open the sales calendar</a></div>
  ${section(`Overdue (${d.counts.overdue})`, rows(d.overdue, "#B91C1C"))}
  ${section(`Due this week (${d.counts.dueSoon})`, rows(d.dueSoon, "#B45309"))}
  ${section(`Upcoming shows with no sales rep (${d.counts.noRep})`, rows(d.noRep, "#5B6470"))}
  <p style="margin-top:22px;color:#8A929C;font-size:12px">Start calling is 60 days before the show, the team email 14 days, the week-before outreach 7. Mark each step done on the calendar and it drops off this list.</p>
</div></body></html>`;
}
