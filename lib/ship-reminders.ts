/**
 * GSC Shipping Center reminders to exhibitors, in the show's timezone (spec
 * section 6): booth still TBD; inbound but no outbound (7 and 2 days before
 * move out); a price waiting for approval; checklists before pickup and before
 * move out. Pure (tested): which are due, and what each says.
 *
 * Every reminder has a key; the email log keeps keys unique, so each goes once
 * however often the job runs. Transactional only: no marketing, ever.
 * Broker language: DTS arranges; carriers move the freight; no promises.
 */

// ---------------------------------------------------------------- time

/** The calendar day ("2026-11-02") in a timezone. */
export function localDay(tz: string | null, at: Date = new Date()): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(at);
}

/** The hour (0 to 23) in a timezone. */
export function localHour(tz: string | null, at: Date = new Date()): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/Los_Angeles", hour: "numeric", hourCycle: "h23" });
  return Number(f.format(at));
}

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
export function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

/** Reminders go out in the show's morning, never overnight. */
export const SEND_FROM_HOUR = 8;
export const SEND_UNTIL_HOUR = 18;

// ---------------------------------------------------------------- which

export type ReminderKind = "booth_tbd" | "no_outbound" | "quote_waiting" | "pickup_checklist" | "moveout_checklist";

export type ReminderLeg = {
  id: string;
  direction: string;
  seq: number;
  stage: string;
  own_carrier: boolean;
  ready_date: string | null;
  pieces: number | null;
  /** The booked load's pickup date, from the TMS. */
  pickup_date: string | null;
  /** When the latest price for this leg was sent. */
  quoted_at: string | null;
};

export type ReminderRequest = {
  id: string;
  closed: string | null;
  email: string | null;
  booth_tbd: boolean;
  legs: ReminderLeg[];
};

export type ShowDates = { move_in_start: string | null; show_start_date: string | null; move_out_start: string | null; show_end_date: string | null };

export type Due = { kind: ReminderKind; key: string; legIds: string[] };

const open = (l: ReminderLeg) => l.stage !== "cancelled";
const booked = (l: ReminderLeg) => l.stage === "booked";

export function dueReminders(r: ReminderRequest, show: ShowDates, today: string): Due[] {
  if (r.closed || !r.email) return [];
  const out: Due[] = [];
  const legs = r.legs.filter(open);
  const inbound = legs.filter((l) => l.direction === "inbound");
  const outbound = legs.filter((l) => l.direction === "outbound");
  const moveIn = show.move_in_start ?? show.show_start_date;
  const moveOut = show.move_out_start ?? show.show_end_date;

  // Booth still TBD: two weeks out, then five days out.
  if (r.booth_tbd && moveIn) {
    const d = daysFrom(today, moveIn);
    if (d <= 14 && d > 5) out.push({ kind: "booth_tbd", key: `booth_tbd:${r.id}:14`, legIds: [] });
    else if (d <= 5 && d >= 0) out.push({ kind: "booth_tbd", key: `booth_tbd:${r.id}:5`, legIds: [] });
  }

  // Coming in with us, no way home booked: 7 and 2 days before move out.
  if (inbound.length && !outbound.length && moveOut) {
    const d = daysFrom(today, moveOut);
    if (d <= 7 && d > 2) out.push({ kind: "no_outbound", key: `no_outbound:${r.id}:7`, legIds: [] });
    else if (d <= 2 && d >= 0) out.push({ kind: "no_outbound", key: `no_outbound:${r.id}:2`, legIds: [] });
  }

  // A price sent two days ago, still not approved: once per price.
  const waiting = legs.filter((l) => l.stage === "quoted" && l.quoted_at && daysFrom(l.quoted_at.slice(0, 10), today) >= 2);
  if (waiting.length) {
    const latest = waiting.map((l) => l.quoted_at!).sort().at(-1)!;
    out.push({ kind: "quote_waiting", key: `quote_waiting:${r.id}:${latest}`, legIds: waiting.map((l) => l.id) });
  }

  // The day before a booked inbound pickup (or the day of, if the job missed it).
  for (const l of inbound.filter(booked)) {
    const pickup = l.pickup_date ?? l.ready_date;
    if (!pickup) continue;
    const d = daysFrom(today, pickup);
    if (d === 1 || d === 0) out.push({ kind: "pickup_checklist", key: `pickup_checklist:${l.id}:${pickup}`, legIds: [l.id] });
  }

  // The day before move out, when outbound is booked.
  if (outbound.some(booked) && moveOut) {
    const d = daysFrom(today, moveOut);
    if (d === 1 || d === 0) out.push({ kind: "moveout_checklist", key: `moveout_checklist:${r.id}:${moveOut}`, legIds: outbound.map((l) => l.id) });
  }
  return out;
}

// ---------------------------------------------------------------- what

export type ReminderContext = {
  publicRef: string;
  contactName: string | null;
  showName: string;
  year: number | string;
  gscName: string;
  booth: string | null;
  moveIn: string | null;
  moveOut: string | null;
  /** The show's request form, to add outbound. Null when the Shipping Center address isn't set. */
  requestUrl: string | null;
  /** Where to get a new status link, with the reference filled in. */
  linkUrl: string | null;
  pickupDate: string | null;
  pieces: number | null;
  onsiteName: string | null;
  onsiteMobile: string | null;
  /** The dock and marshalling yard map from the kit, when staff added one. */
  dockMapUrl?: string | null;
  staffName: string | null;
  phone: string;
};

const nice = (ymd: string | null) =>
  ymd ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : "";
const hi = (n: string | null) => `Hi ${(n ?? "").trim().split(/\s+/)[0] || "there"},`;

export function reminderEmail(kind: ReminderKind, c: ReminderContext): { subject: string; text: string } {
  const show = `${c.showName} ${c.year}`;
  const statusLine = c.linkUrl
    ? `Your status page is in the email you got when you confirmed. Lost it? Get a new link here: ${c.linkUrl}`
    : "Your status page is in the email you got when you confirmed.";
  const sign = [c.staffName ?? "The DTS trade show team", "DTS (Diversified Transportation Services), shipping for exhibitors at " + c.gscName + " shows", c.phone].join("\n");
  const ref = `Request ${c.publicRef}.`;
  let subject: string;
  let body: string[];
  switch (kind) {
    case "booth_tbd":
      subject = `Your booth number for ${show}`;
      body = [
        `Your shipping request for ${show} still says booth TBD, so your labels print BOOTH TBD.`,
        `Once ${c.gscName} assigns your booth, add it on your status page and print your labels again, so every piece is marked for the right booth.${c.moveIn ? ` Move in starts ${nice(c.moveIn)}.` : ""}`,
        statusLine,
      ];
      break;
    case "no_outbound":
      subject = `How is your freight getting home from ${show}?`;
      body = [
        `Your freight is coming to ${show} with DTS, but there is no return shipment on your request yet.${c.moveOut ? ` Move out starts ${nice(c.moveOut)}.` : ""}`,
        `Freight left on the show floor without a carrier and a completed material handling agreement is moved by the show's contractor on their terms and at their rates. Booking the return now gives us time to line up a carrier and get your outbound paperwork done before the show closes.`,
        c.requestUrl ? `Request your outbound shipment here: ${c.requestUrl}` : "Reply to this email and we will set up your outbound shipment.",
      ];
      break;
    case "quote_waiting":
      subject = `Your shipping price for ${show} is waiting`;
      body = [
        `We sent you a price for your ${show} shipping and it is waiting for your approval. Nothing is booked until you approve.`,
        "Approve it on your status page, or reply to this email and say approved. If something changed, reply and tell us.",
        statusLine,
      ];
      break;
    case "pickup_checklist":
      subject = `Pickup ${nice(c.pickupDate)}: your ${show} freight`;
      body = [
        `Your freight for ${show} is scheduled for pickup ${nice(c.pickupDate)}. Before the driver arrives:`,
        [
          `- A label on every piece${c.pieces ? `, ${c.pieces} in all` : ""}, with your booth number. Reprint them from your status page if you need to.`,
          "- The bill of lading from us in hand, for the driver to sign.",
          "- Freight packed, wrapped and ready at the dock or door.",
          "- Someone there who can answer the phone if the driver calls.",
        ].join("\n"),
        "The carrier gives the pickup window; if they are running late, call us and we will chase it.",
        statusLine,
      ];
      break;
    case "moveout_checklist":
      subject = `Move out at ${show}: your outbound checklist`;
      body = [
        `Move out starts ${nice(c.moveOut)}, and your outbound shipment is booked with DTS. Before you leave the booth:`,
        [
          "- A label on every piece, with your return address.",
          `- Your material handling agreement (the outbound shipping form) turned in to the ${c.gscName} service desk.`,
          "- The bill of lading from us in hand.",
          `- ${c.onsiteName ? `${c.onsiteName}${c.onsiteMobile ? ` (${c.onsiteMobile})` : ""} reachable` : "Your on-site contact reachable"} until the carrier checks in and the freight leaves the dock.`,
          ...(c.dockMapUrl ? [`- The dock and marshalling yard map from the kit, for your on-site contact: ${c.dockMapUrl}`] : []),
        ].join("\n"),
        "If the carrier looks late for check in, call us right away and we will chase it.",
        statusLine,
      ];
      break;
  }
  return { subject, text: [hi(c.contactName), ...body, ref, sign].join("\n\n") };
}
