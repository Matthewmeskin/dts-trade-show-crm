import { formatDate, formatDateRange, formatShortDate } from "@/lib/format";
import { shiftDays } from "@/lib/sales";
import { weekStart } from "@/lib/partners";

/**
 * The GSC manifest: what a general service contractor's warehouse and floor
 * team need from us for one show.
 *
 *   Before the show: the inbound manifest - which exhibitors are shipping with
 *   DTS to their warehouse or the show site, and when it should land. Weekly,
 *   then daily in the last week before move-in.
 *   From the show opening: the outbound list - which booths have outbound
 *   booked with DTS, with the carrier and pickup, so it's ready at teardown.
 *
 * It covers every DTS load to the show, not just ones a partner referred -
 * which is why it only ever goes to a GSC (their warehouse receives that
 * freight anyway). A builder or organizer gets the clients-only weekly report
 * instead. Like that report it carries operational facts only: never costs,
 * margins, rates or notes. A rep sends it.
 */

export type ManifestShow = {
  id: string;
  show_name: string;
  show_start_date: string | null;
  show_end_date: string | null;
  move_in_start: string | null;
  move_in_end: string | null;
  move_out_start: string | null;
  move_out_end: string | null;
  advance_warehouse_open: string | null;
  advance_warehouse_cutoff: string | null;
  advance_warehouse_name: string | null;
};

export type ManifestShipment = {
  id: string;
  exhibitor: string;
  direction: string | null;
  status: string;
  destination_type: string | null;
  booth_number: string | null;
  pieces: number | null;
  weight: number | null;
  carrier: string | null;
  pro_number: string | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  origin_city: string | null;
  origin_state: string | null;
};

export type Cadence = "weekly" | "daily" | "outbound" | "none";

/**
 * Test and house accounts that live in the TMS ("Jimmy W Test 2025", "General
 * Quote Account", DTS itself). Real to us, noise - or worse - on an email to a
 * partner, so they never appear on one.
 */
export function isInternalAccount(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return /\btest\b/.test(n) || n.includes("general quote account") || /^diversified transportation( services)?\b/.test(n);
}

/** Moving on the manifest means actually shipping: a quote isn't freight yet. */
const MOVING = new Set(["booked", "in_transit", "delivered"]);
/** Inbound goes daily this many days before move-in (or the show) starts. */
export const DAILY_FROM_DAYS = 7;
/** And weekly from this far out. Before that there's nothing useful to send. */
export const WEEKLY_FROM_DAYS = 45;
/** Keep sending the outbound list this long after move-out ends. */
export const OUTBOUND_TAIL_DAYS = 3;

const firstDay = (s: ManifestShow) => s.move_in_start ?? s.show_start_date;
const lastDay = (s: ManifestShow) => s.move_out_end ?? s.show_end_date ?? s.show_start_date;

/** Which manifest a show wants today. */
export function manifestCadence(show: ManifestShow, today: string): Cadence {
  const start = firstDay(show);
  if (!start) return "none";
  const opens = show.show_start_date ?? start;
  const end = lastDay(show) ?? opens;
  if (today >= opens) return today <= shiftDays(end, OUTBOUND_TAIL_DAYS)! ? "outbound" : "none";
  if (today >= shiftDays(start, -DAILY_FROM_DAYS)!) return "daily";
  if (today >= shiftDays(start, -WEEKLY_FROM_DAYS)!) return "weekly";
  return "none";
}

/** Is a manifest owed now, given when it was last sent (a Pacific day, or null)? */
export function manifestDue(cadence: Cadence, lastSentDay: string | null, today: string): boolean {
  if (cadence === "none") return false;
  if (!lastSentDay) return true;
  if (cadence === "weekly") return lastSentDay < weekStart(today);
  return lastSentDay < today; // daily, and the outbound list daily through teardown
}

export type ManifestRow = {
  exhibitor: string;
  booth: string | null;
  where: string;
  pieces: number | null;
  weight: number | null;
  carrier: string | null;
  pro: string | null;
  from: string | null;
  status: string;
  when: string;
};

export type Manifest = {
  subject: string;
  kind: "inbound" | "outbound";
  inbound: ManifestRow[];
  outbound: ManifestRow[];
  /** Exhibitors with inbound on this manifest but no outbound booked with DTS yet. For the rep, not the GSC. */
  outboundMissing: string[];
  /** Loads the TMS still shows as moving well past their dates. Kept off the manifest; for the rep. */
  needsCheck: { exhibitor: string; status: string; pickup: string | null; pro: string | null }[];
  totals: { loads: number; pieces: number; weight: number };
  html: string;
  text: string;
};

const place = (c: string | null, s: string | null) => [c?.trim(), s?.trim()].filter(Boolean).join(", ") || null;

function inboundRow(s: ManifestShipment): ManifestRow {
  const eta = s.actual_delivery_date
    ? `Delivered ${formatShortDate(s.actual_delivery_date)}`
    : s.status === "delivered"
      ? "Delivered"
      : s.estimated_delivery_date && (!s.pickup_date || s.estimated_delivery_date >= s.pickup_date)
      ? `Expected ${formatShortDate(s.estimated_delivery_date)}`
      : s.pickup_date
        ? `Picks up ${formatShortDate(s.pickup_date)}`
        : "Date to follow";
  return {
    exhibitor: s.exhibitor,
    booth: s.booth_number,
    where: s.destination_type === "direct_to_show" ? "Direct to show" : s.destination_type === "advance_warehouse" ? "Advance warehouse" : "—",
    pieces: s.pieces,
    weight: s.weight,
    carrier: s.carrier,
    pro: s.pro_number,
    from: place(s.origin_city, s.origin_state),
    status: s.status === "delivered" ? "Delivered" : s.status === "in_transit" ? "In transit" : "Booked",
    when: eta,
  };
}

function outboundRow(s: ManifestShipment): ManifestRow {
  return {
    exhibitor: s.exhibitor,
    booth: s.booth_number,
    where: "Outbound",
    pieces: s.pieces,
    weight: s.weight,
    carrier: s.carrier,
    pro: s.pro_number,
    from: null,
    status: s.status === "delivered" ? "Delivered" : s.status === "in_transit" ? "Picked up" : "Booked",
    when: s.pickup_date ? `Pickup ${formatShortDate(s.pickup_date)}` : "Pickup time to follow",
  };
}

export function buildManifest(input: {
  gscName: string;
  show: ManifestShow;
  shipments: ManifestShipment[];
  today: string;
  rep: { name: string; phone: string | null; email: string | null } | null;
}): Manifest {
  const { show, today } = input;
  const cadence = manifestCadence(show, today);
  const kind: Manifest["kind"] = cadence === "outbound" ? "outbound" : "inbound";
  const byBooth = (a: ManifestRow, b: ManifestRow) =>
    (a.booth ?? "~").localeCompare(b.booth ?? "~", undefined, { numeric: true }) || a.exhibitor.localeCompare(b.exhibitor);

  // Same rule as the partner report: booked / in transit well past its dates
  // means the TMS is behind, so it stays off what the GSC sees until checked.
  const overdueBefore = shiftDays(today, -3)!;
  const looksStale = (s: ManifestShipment) => {
    if (s.status !== "booked" && s.status !== "in_transit") return false;
    const etaOk = s.estimated_delivery_date && (!s.pickup_date || s.estimated_delivery_date >= s.pickup_date);
    const due = (etaOk ? s.estimated_delivery_date : null) ?? s.pickup_date;
    return !!due && due < overdueBefore;
  };
  const needsCheck = input.shipments
    .filter((s) => MOVING.has(s.status) && looksStale(s))
    .map((s) => ({ exhibitor: s.exhibitor, status: s.status === "booked" ? "Booked" : "In transit", pickup: s.pickup_date, pro: s.pro_number }));
  const moving = input.shipments.filter((s) => MOVING.has(s.status) && !looksStale(s) && !isInternalAccount(s.exhibitor));
  const inbound = moving.filter((s) => s.direction !== "move_out").map(inboundRow).sort(byBooth);
  const outbound = moving.filter((s) => s.direction === "move_out").map(outboundRow).sort(byBooth);
  const withOutbound = new Set(moving.filter((s) => s.direction === "move_out").map((s) => s.exhibitor));
  const outboundMissing = [...new Set(moving.filter((s) => s.direction !== "move_out").map((s) => s.exhibitor))]
    .filter((e) => !withOutbound.has(e))
    .sort();

  const list = kind === "outbound" ? outbound : inbound;
  const totals = {
    loads: list.length,
    pieces: list.reduce((n, r) => n + (r.pieces ?? 0), 0),
    weight: list.reduce((n, r) => n + (r.weight ?? 0), 0),
  };
  const subject =
    kind === "outbound"
      ? `${show.show_name} — DTS outbound list for ${input.gscName}, ${formatDate(today)}`
      : `${show.show_name} — DTS inbound manifest for ${input.gscName}, ${formatDate(today)}`;
  return {
    subject,
    kind,
    inbound,
    outbound,
    outboundMissing,
    needsCheck,
    totals,
    html: renderHtml({ ...input, kind, inbound, outbound, totals }),
    text: renderText({ ...input, kind, inbound, outbound, totals }),
  };
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));

function renderTable(rows: ManifestRow[], outbound: boolean): string {
  const td = "padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;vertical-align:top;";
  const th = "padding:5px 8px;border-bottom:1px solid #cbd5e1;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;";
  const head = outbound
    ? ["Booth", "Exhibitor", "Pcs", "Lbs", "Carrier", "PRO", "Pickup", "Status"]
    : ["Booth", "Exhibitor", "To", "Pcs", "Lbs", "Carrier", "PRO", "From", "Arrival", "Status"];
  const cells = (r: ManifestRow) =>
    outbound
      ? [r.booth ?? "—", r.exhibitor, num(r.pieces), num(r.weight), r.carrier ?? "—", r.pro ?? "—", r.when, r.status]
      : [r.booth ?? "—", r.exhibitor, r.where, num(r.pieces), num(r.weight), r.carrier ?? "—", r.pro ?? "—", r.from ?? "—", r.when, r.status];
  return `<table style="border-collapse:collapse;width:100%;"><tr>${head.map((h) => `<th style="${th}">${h}</th>`).join("")}</tr>
${rows.map((r) => `<tr>${cells(r).map((c) => `<td style="${td}">${esc(c)}</td>`).join("")}</tr>`).join("\n")}
</table>`;
}

function signOff(rep: { name: string; phone: string | null; email: string | null } | null) {
  return rep ? [rep.name, rep.phone, rep.email].filter(Boolean).join(" · ") : "Your DTS trade show team";
}

function renderHtml(r: {
  gscName: string;
  show: ManifestShow;
  kind: Manifest["kind"];
  inbound: ManifestRow[];
  outbound: ManifestRow[];
  totals: Manifest["totals"];
  today: string;
  rep: { name: string; phone: string | null; email: string | null } | null;
}): string {
  const dates = formatDateRange(r.show.show_start_date, r.show.show_end_date);
  const intro =
    r.kind === "outbound"
      ? `Outbound booked with DTS for ${esc(r.show.show_name)} as of ${esc(formatDate(r.today))}. These booths have a carrier arranged for teardown.`
      : `Freight shipping with DTS to ${esc(r.show.show_name)} as of ${esc(formatDate(r.today))}, to the advance warehouse and direct to the show site.`;
  const rows = r.kind === "outbound" ? r.outbound : r.inbound;
  const body = rows.length
    ? `<p style="font-size:13px;color:#334155;margin:0 0 10px;">${r.totals.loads} load${r.totals.loads === 1 ? "" : "s"} · ${num(r.totals.pieces)} pieces · ${num(r.totals.weight)} lbs</p>${renderTable(rows, r.kind === "outbound")}`
    : `<p style="font-size:13px;color:#334155;">Nothing booked with DTS for this show yet. We'll send an update as loads are booked.</p>`;
  const followUp =
    r.kind === "inbound" && r.outbound.length
      ? `<h3 style="font-size:14px;margin:20px 0 6px;">Outbound already booked (${r.outbound.length})</h3>${renderTable(r.outbound, true)}`
      : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:860px;">
<p style="font-size:14px;margin:0 0 4px;">Hi ${esc(r.gscName)} team,</p>
<p style="font-size:14px;margin:0 0 14px;color:#334155;">${intro}</p>
<h2 style="font-size:16px;margin:0 0 6px;">${esc(r.show.show_name)} <span style="font-weight:400;color:#64748b;font-size:13px;">${esc(dates)}</span></h2>
${body}
${followUp}
<p style="font-size:12px;color:#64748b;margin:18px 0 4px;">Arrival dates are the carriers' estimates. If anything on here doesn't match what's on your dock, reply and we'll sort it out with the carrier.</p>
<p style="font-size:13px;color:#334155;margin:12px 0 0;">${esc(signOff(r.rep))}<br>Diversified Transportation Services</p>
</div>`;
}

function renderText(r: {
  show: ManifestShow;
  kind: Manifest["kind"];
  inbound: ManifestRow[];
  outbound: ManifestRow[];
  totals: Manifest["totals"];
  today: string;
  rep: { name: string; phone: string | null; email: string | null } | null;
}): string {
  const lines: string[] = [];
  const rows = r.kind === "outbound" ? r.outbound : r.inbound;
  lines.push(
    r.kind === "outbound"
      ? `Outbound booked with DTS for ${r.show.show_name} as of ${formatDate(r.today)}:`
      : `Freight shipping with DTS to ${r.show.show_name} as of ${formatDate(r.today)}:`,
    "",
  );
  if (!rows.length) lines.push("Nothing booked with DTS for this show yet.");
  for (const x of rows) {
    lines.push(
      `- Booth ${x.booth ?? "—"} · ${x.exhibitor} · ${x.where} · ${num(x.pieces)} pcs / ${num(x.weight)} lbs · ${x.carrier ?? "carrier TBD"}${x.pro ? ` PRO ${x.pro}` : ""} · ${x.when} · ${x.status}`,
    );
  }
  lines.push("", "Arrival dates are the carriers' estimates. Reply if anything doesn't match your dock.", "", signOff(r.rep), "Diversified Transportation Services");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Finding the loads that belong on a show's manifest but aren't linked to it
// ---------------------------------------------------------------------------

export type CandidateShow = ManifestShow & {
  venue_id: string | null;
  advance_warehouse_zip: string | null;
  direct_to_show_zip: string | null;
};

export type CandidateShipment = {
  id: string;
  venue_id: string | null;
  direction: string | null;
  pickup_date: string | null;
  show_date: string | null;
  created_at: string;
  consignee_zip: string | null;
  origin_zip: string | null;
};

const zip5 = (z: string | null) => (z ?? "").trim().slice(0, 5) || null;

/**
 * Why an unlinked load probably belongs to this show, or null. It has to fall
 * in the show's freight window (advance warehouse opening minus a week, to
 * move-out plus a week) AND point at the show's venue, its advance warehouse
 * ZIP or its show-site ZIP. A person still confirms each one - the Convention
 * Center hosts a show most weeks.
 */
export function candidateReason(show: CandidateShow, s: CandidateShipment): string | null {
  const open = [show.advance_warehouse_open, show.move_in_start, show.show_start_date].filter((d): d is string => !!d).sort()[0];
  const close = lastDay(show);
  if (!open || !close) return null;
  const d = s.pickup_date ?? s.show_date ?? s.created_at.slice(0, 10);
  if (d < shiftDays(open, -30)! || d > shiftDays(close, 10)!) return null;
  const adv = zip5(show.advance_warehouse_zip);
  const direct = zip5(show.direct_to_show_zip);
  const to = zip5(s.consignee_zip);
  const from = zip5(s.origin_zip);
  if (s.direction !== "move_out" && adv && to === adv) return "Delivers to the advance warehouse ZIP";
  if (s.direction !== "move_out" && direct && to === direct) return "Delivers to the show-site ZIP";
  if (s.direction === "move_out" && direct && from === direct) return "Picks up from the show-site ZIP";
  if (show.venue_id && s.venue_id === show.venue_id) return "Same venue, in the show's freight window";
  return null;
}
