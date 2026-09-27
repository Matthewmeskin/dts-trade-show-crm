import { formatDate, formatDateRange, formatShortDate } from "@/lib/format";
import { shiftDays } from "@/lib/sales";
import { weekStart } from "@/lib/partners";
import { isInternalAccount } from "@/lib/gsc-manifest";

/**
 * The weekly pilot status email for a partner: where each of their clients'
 * freight stands, and which clients still have no outbound booked for a show
 * that's coming up. Outbound is the hook - exhibitors with nothing arranged
 * at teardown get pushed onto the show carrier at a high price - so that list
 * leads the email.
 *
 * This goes to someone outside DTS. It carries status, dates, PRO numbers and
 * tracking only: never notes, costs, margins or carrier rates. A rep reads it
 * and sends it; nothing sends it automatically.
 */

export type ReportClient = { exhibitor_id: string; company_name: string; in_pilot: boolean };
export type ReportShow = { id: string; show_name: string; start: string | null; end: string | null };
export type ReportShipment = {
  id: string;
  exhibitor_id: string | null;
  show_id: string | null;
  direction: string | null;
  status: string;
  destination_type: string | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  show_date: string | null;
  created_at: string;
  pro_number: string | null;
  tracking_url: string | null;
  booth_number: string | null;
  pieces: number | null;
  origin_city: string | null;
  origin_state: string | null;
  consignee_city: string | null;
  consignee_state: string | null;
};

export type ReportRow = {
  client: string;
  pilot: boolean;
  kind: string;
  /** "Anaheim, CA → Las Vegas, NV" when the TMS has both ends. */
  route: string | null;
  status: string;
  tone: "good" | "moving" | "waiting" | "attention";
  detail: string;
  pro: string | null;
  tracking: string | null;
};

export type ReportGroup = { title: string; dates: string | null; rows: ReportRow[] };
export type OutboundGap = { client: string; pilot: boolean; show: string; showEnds: string | null };

/** A load the TMS still shows as moving after its dates have passed. Kept out of the email. */
export type NeedsCheck = { client: string; kind: string; status: string; pickup: string | null; pro: string | null };

export type PartnerReport = {
  subject: string;
  /** For the rep, not the partner: statuses that look out of date in the TMS. */
  needsCheck: NeedsCheck[];
  weekOf: string;
  counts: { inMotion: number; delivered: number; outboundBooked: number; outboundGaps: number; attention: number; quoted: number };
  gaps: OutboundGap[];
  groups: ReportGroup[];
  empty: boolean;
  html: string;
  text: string;
};

/** Delivered freight stays on the report this long, so the partner sees it land. */
export const DELIVERED_DAYS = 14;
/** Open shipments older than this are left off: they're stale TMS records, not live freight. */
export const STALE_OPEN_DAYS = 45;
/** Booked / in transit this many days past its expected date looks out of date in the TMS. */
export const OVERDUE_MOVING_DAYS = 3;
/** A quote with no pickup date stays on the report this long. */
export const QUOTE_FRESH_DAYS = 14;
/** How far ahead a show counts for the outbound check. */
export const OUTBOUND_HORIZON_DAYS = 60;

const OUTBOUND_BOOKED = new Set(["booked", "in_transit", "delivered"]);

const kindOf = (s: ReportShipment) =>
  s.direction === "move_in"
    ? s.destination_type === "advance_warehouse"
      ? "Inbound to advance warehouse"
      : s.destination_type === "direct_to_show"
        ? "Inbound direct to show"
        : "Inbound"
    : s.direction === "move_out"
      ? "Outbound"
      : "Shipment";

function statusOf(s: ReportShipment): Pick<ReportRow, "status" | "tone" | "detail"> {
  const pickup = s.pickup_date ? `pickup ${formatShortDate(s.pickup_date)}` : null;
  // An expected date before pickup is a data-entry slip; leave it off rather than print it.
  const etaOk = s.estimated_delivery_date && (!s.pickup_date || s.estimated_delivery_date >= s.pickup_date);
  const eta = etaOk ? `expected ${formatShortDate(s.estimated_delivery_date)}` : null;
  switch (s.status) {
    case "delivered":
      return {
        status: "Delivered",
        tone: "good",
        detail: s.actual_delivery_date ? formatShortDate(s.actual_delivery_date) : "",
      };
    case "in_transit":
      return { status: "In transit", tone: "moving", detail: [eta].filter(Boolean).join(" · ") };
    case "booked":
      return { status: "Booked", tone: "moving", detail: [pickup, eta].filter(Boolean).join(" · ") };
    case "quoted":
      return { status: "Quoted — waiting on the OK to book", tone: "waiting", detail: pickup ?? "" };
    default:
      return { status: "We're working on it — your DTS contact will reach out", tone: "attention", detail: "" };
  }
}

const place = (city: string | null, state: string | null) =>
  [city?.trim(), state?.trim()].filter(Boolean).join(", ") || null;

function routeOf(s: ReportShipment): string | null {
  const from = place(s.origin_city, s.origin_state);
  const to = place(s.consignee_city, s.consignee_state);
  return from && to ? `${from} → ${to}` : to ? `to ${to}` : from ? `from ${from}` : null;
}

/** The day a shipment is "about", for staleness. */
const anchor = (s: ReportShipment) => s.pickup_date ?? s.show_date ?? s.created_at.slice(0, 10);

export function buildPartnerReport(input: {
  partnerName: string;
  clients: ReportClient[];
  shows: ReportShow[];
  /** show_id → exhibitor_ids on that show's exhibitor list, for clients with no freight booked yet. */
  rosters: { show_id: string; exhibitor_id: string }[];
  shipments: ReportShipment[];
  today: string;
  rep: { name: string; phone: string | null; email: string | null } | null;
}): PartnerReport {
  const { today } = input;
  const clientBy = new Map(input.clients.map((c) => [c.exhibitor_id, c]));
  const showBy = new Map(input.shows.map((s) => [s.id, s]));
  const deliveredSince = shiftDays(today, -DELIVERED_DAYS)!;
  const staleBefore = shiftDays(today, -STALE_OPEN_DAYS)!;
  const horizon = shiftDays(today, OUTBOUND_HORIZON_DAYS)!;

  const mine = input.shipments.filter(
    (s) => s.exhibitor_id && clientBy.has(s.exhibitor_id) && !isInternalAccount(clientBy.get(s.exhibitor_id)!.company_name),
  );
  const quoteSince = shiftDays(today, -QUOTE_FRESH_DAYS)!;
  const live = mine.filter((s) => {
    if (s.status === "delivered") return (s.actual_delivery_date ?? anchor(s)) >= deliveredSince;
    // A quote is only news while it can still be booked: pickup still ahead,
    // or no pickup date and quoted recently. Older quotes were likely lost.
    if (s.status === "quoted") return s.pickup_date ? s.pickup_date >= today : s.created_at.slice(0, 10) >= quoteSince;
    return anchor(s) >= staleBefore;
  });

  // Moving freight whose dates have passed well behind it: the TMS status is
  // probably behind. Keep it out of the partner's email; tell the rep instead.
  const overdueBefore = shiftDays(today, -OVERDUE_MOVING_DAYS)!;
  const looksStale = (s: ReportShipment) => {
    if (s.status !== "booked" && s.status !== "in_transit") return false;
    const etaOk = s.estimated_delivery_date && (!s.pickup_date || s.estimated_delivery_date >= s.pickup_date);
    const due = (etaOk ? s.estimated_delivery_date : null) ?? s.pickup_date;
    return !!due && due < overdueBefore;
  };
  const needsCheck: NeedsCheck[] = live.filter(looksStale).map((s) => ({
    client: clientBy.get(s.exhibitor_id!)!.company_name,
    kind: kindOf(s),
    status: s.status === "booked" ? "Booked" : "In transit",
    pickup: s.pickup_date,
    pro: s.pro_number,
  }));
  const shown = live.filter((s) => !looksStale(s));

  // Outbound check: every client at a show that's on now or coming up soon,
  // who has no outbound booked for it.
  const soonShows = [...showBy.values()].filter(
    (s) => s.start && s.start <= horizon && (s.end ?? s.start) >= today,
  );
  const gaps: OutboundGap[] = [];
  for (const show of soonShows) {
    const at = new Set<string>();
    for (const s of mine) if (s.show_id === show.id && s.direction === "move_in") at.add(s.exhibitor_id!);
    for (const r of input.rosters) if (r.show_id === show.id && clientBy.has(r.exhibitor_id)) at.add(r.exhibitor_id);
    for (const ex of at) {
      const booked = mine.some(
        (s) => s.exhibitor_id === ex && s.show_id === show.id && s.direction === "move_out" && OUTBOUND_BOOKED.has(s.status),
      );
      if (!booked) {
        const c = clientBy.get(ex)!;
        gaps.push({ client: c.company_name, pilot: c.in_pilot, show: show.show_name, showEnds: show.end ?? show.start });
      }
    }
  }
  gaps.sort((a, b) => (a.showEnds ?? "").localeCompare(b.showEnds ?? "") || a.client.localeCompare(b.client));

  // Group live freight by show, soonest first; freight with no show last.
  const groupsBy = new Map<string, ReportGroup & { sort: string }>();
  for (const s of shown) {
    const show = s.show_id ? showBy.get(s.show_id) : undefined;
    const key = show?.id ?? "_other";
    if (!groupsBy.has(key)) {
      groupsBy.set(key, {
        title: show?.show_name ?? "Other freight",
        dates: show ? formatDateRange(show.start, show.end) : null,
        rows: [],
        sort: show?.start ?? "9999",
      });
    }
    const c = clientBy.get(s.exhibitor_id!)!;
    groupsBy.get(key)!.rows.push({
      client: c.company_name,
      pilot: c.in_pilot,
      kind: kindOf(s) + (s.booth_number ? ` · booth ${s.booth_number}` : ""),
      route: routeOf(s),
      ...statusOf(s),
      // Only for freight that's actually moving: a quote's tracking link points at nothing yet.
      pro: s.status === "quoted" ? null : s.pro_number,
      tracking:
        s.status !== "quoted" && s.tracking_url && /^https?:\/\//i.test(s.tracking_url) ? s.tracking_url : null,
    });
  }
  const groups = [...groupsBy.values()]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map((g) => ({
      title: g.title,
      dates: g.dates,
      rows: g.rows.sort((a, b) => a.client.localeCompare(b.client) || a.kind.localeCompare(b.kind)),
    }));

  const counts = {
    inMotion: shown.filter((s) => s.status === "booked" || s.status === "in_transit").filter((s) => s.direction !== "move_out").length,
    delivered: shown.filter((s) => s.status === "delivered").length,
    outboundBooked: shown.filter((s) => s.direction === "move_out" && OUTBOUND_BOOKED.has(s.status)).length,
    outboundGaps: gaps.length,
    attention: shown.filter((s) => !["quoted", "booked", "in_transit", "delivered"].includes(s.status)).length,
    quoted: shown.filter((s) => s.status === "quoted").length,
  };
  const weekOf = weekStart(today);
  const subject = `${input.partnerName} — client freight status, week of ${formatDate(weekOf)}`;
  const empty = !groups.length && !gaps.length;
  return {
    subject,
    needsCheck,
    weekOf,
    counts,
    gaps,
    groups,
    empty,
    html: renderHtml({ partnerName: input.partnerName, weekOf, counts, gaps, groups, rep: input.rep, empty }),
    text: renderText({ weekOf, gaps, groups, rep: input.rep, empty }),
  };
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TONE: Record<ReportRow["tone"], string> = {
  good: "#047857",
  moving: "#1d4ed8",
  waiting: "#b45309",
  attention: "#7a1f2b",
};

function signOff(rep: { name: string; phone: string | null; email: string | null } | null) {
  if (!rep) return "Your DTS trade show team";
  return [rep.name, rep.phone, rep.email].filter(Boolean).join(" · ");
}

function renderHtml(r: {
  partnerName: string;
  weekOf: string;
  counts: PartnerReport["counts"];
  gaps: OutboundGap[];
  groups: ReportGroup[];
  rep: { name: string; phone: string | null; email: string | null } | null;
  empty: boolean;
}): string {
  const td = "padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;vertical-align:top;";
  const th = "padding:6px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;";
  const pilot = (p: boolean) => (p ? ' <span style="font-size:10px;color:#7a1f2b;font-weight:600;">PILOT</span>' : "");
  const tiles = [
    ["Outbound not booked yet", r.counts.outboundGaps, r.counts.outboundGaps ? "#7a1f2b" : "#047857"],
    ["Outbound booked", r.counts.outboundBooked, "#0f172a"],
    ["Inbound on the way", r.counts.inMotion, "#0f172a"],
    ["Delivered recently", r.counts.delivered, "#0f172a"],
  ]
    .map(
      ([label, n, color]) =>
        `<td style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;"><div style="font-size:11px;color:#64748b;">${label}</div><div style="font-size:22px;font-weight:600;color:${color};">${n}</div></td>`,
    )
    .join('<td style="width:8px;"></td>');

  const gapsHtml = r.gaps.length
    ? `<h3 style="font-size:15px;margin:22px 0 6px;color:#7a1f2b;">Outbound not booked yet</h3>
<p style="font-size:13px;color:#334155;margin:0 0 8px;">Anything without outbound arranged at teardown gets pushed onto the show carrier, usually at a higher price. Reply with the return address and we'll get these set up before the show closes.</p>
<table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Client</th><th style="${th}">Show</th><th style="${th}">Show closes</th></tr>
${r.gaps.map((g) => `<tr><td style="${td}">${esc(g.client)}${pilot(g.pilot)}</td><td style="${td}">${esc(g.show)}</td><td style="${td}">${g.showEnds ? esc(formatDate(g.showEnds)) : "—"}</td></tr>`).join("\n")}
</table>`
    : "";

  const groupsHtml = r.groups
    .map(
      (g) => `<h3 style="font-size:15px;margin:22px 0 6px;color:#0f172a;">${esc(g.title)}${g.dates ? ` <span style="font-weight:400;color:#64748b;font-size:13px;">${esc(g.dates)}</span>` : ""}</h3>
<table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Client</th><th style="${th}">Shipment</th><th style="${th}">Status</th><th style="${th}">PRO / tracking</th></tr>
${g.rows
  .map(
    (row) =>
      `<tr><td style="${td}">${esc(row.client)}${pilot(row.pilot)}</td><td style="${td}">${esc(row.kind)}${row.route ? `<br><span style="color:#64748b;">${esc(row.route)}</span>` : ""}</td><td style="${td}"><span style="color:${TONE[row.tone]};font-weight:600;">${esc(row.status)}</span>${row.detail ? `<br><span style="color:#64748b;">${esc(row.detail)}</span>` : ""}</td><td style="${td}">${[row.pro ? esc(row.pro) : "", row.tracking ? `<a href="${esc(row.tracking)}" style="color:#1d4ed8;">track</a>` : ""].filter(Boolean).join(" ") || "—"}</td></tr>`,
  )
  .join("\n")}
</table>`,
    )
    .join("\n");

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:720px;">
<p style="font-size:14px;margin:0 0 4px;">Hi ${esc(r.partnerName)} team,</p>
<p style="font-size:14px;margin:0 0 14px;color:#334155;">Here's where your clients' freight stands for the week of ${esc(formatDate(r.weekOf))}.</p>
${r.empty ? `<p style="font-size:14px;color:#334155;">No freight moving for your clients this week. When you have a client heading to a show, send it over and we'll take it from there.</p>` : `<table style="border-collapse:separate;"><tr>${tiles}</tr></table>`}
${gapsHtml}
${groupsHtml}
<p style="font-size:13px;color:#334155;margin:22px 0 4px;">Questions on any of these, or a client we should be looking after that isn't here? Reply to this email or give me a call.</p>
<p style="font-size:13px;color:#334155;margin:0;">${esc(signOff(r.rep))}<br>Diversified Transportation Services</p>
</div>`;
}

function renderText(r: {
  weekOf: string;
  gaps: OutboundGap[];
  groups: ReportGroup[];
  rep: { name: string; phone: string | null; email: string | null } | null;
  empty: boolean;
}): string {
  const lines: string[] = [`Here's where your clients' freight stands for the week of ${formatDate(r.weekOf)}.`, ""];
  if (r.empty) {
    lines.push("No freight moving for your clients this week. When you have a client heading to a show, send it over and we'll take it from there.", "");
  }
  if (r.gaps.length) {
    lines.push("OUTBOUND NOT BOOKED YET", "Reply with the return address and we'll get these set up before the show closes.");
    for (const g of r.gaps) lines.push(`- ${g.client}${g.pilot ? " (pilot)" : ""} — ${g.show}, closes ${g.showEnds ? formatDate(g.showEnds) : "—"}`);
    lines.push("");
  }
  for (const g of r.groups) {
    lines.push(`${g.title.toUpperCase()}${g.dates ? ` (${g.dates})` : ""}`);
    for (const row of g.rows) {
      lines.push(`- ${row.client}: ${row.kind}${row.route ? ` (${row.route})` : ""} — ${row.status}${row.detail ? ` (${row.detail})` : ""}${row.pro ? ` · PRO ${row.pro}` : ""}`);
    }
    lines.push("");
  }
  lines.push("Questions on any of these? Reply here or give me a call.", "", signOff(r.rep), "Diversified Transportation Services");
  return lines.join("\n");
}
