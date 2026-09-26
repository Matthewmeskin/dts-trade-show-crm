/**
 * Date + number formatting helpers.
 *
 * Postgres `date` columns come back as "YYYY-MM-DD" strings. We parse them at
 * LOCAL midnight (never `new Date("YYYY-MM-DD")`, which parses as UTC and can
 * shift the calendar day) so date math stays in the user's calendar.
 */

/**
 * Parse a "YYYY-MM-DD" (or ISO) string into a local-midnight Date.
 *
 * A `timestamptz` arrives as an instant with a zone marker; its calendar day
 * is taken in the company zone, never by slicing the UTC string, which puts
 * anything after 5pm Pacific on the next day.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const datePart = ZONED_INSTANT.test(value) ? dayOf(value) : value.slice(0, 10);
  if (!datePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// An ISO timestamp that carries a zone ("Z" or an offset), as Postgres and
// toISOString() produce. A bare date or a zoneless timestamp is not one.
const ZONED_INSTANT = /^\d{4}-\d{2}-\d{2}[T ].*(Z|[+-]\d{2}:?\d{2})$/;

/**
 * The company's calendar zone. The server runs in UTC, so after 5pm Pacific
 * "today" by the server clock is already tomorrow — every "what day is it"
 * must be pinned here or the calendar rings the wrong day each evening.
 */
export const APP_TIME_ZONE = "America/Los_Angeles";

// en-CA renders as YYYY-MM-DD, which is exactly the shape parseDate takes.
const appDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day ("YYYY-MM-DD") an instant falls on in the company zone. */
export function dayOf(instant: string | Date | null | undefined): string | null {
  if (!instant) return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  return appDayFormat.format(d);
}

const appPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Minutes the company zone is ahead of UTC at an instant (negative in the US). */
function zoneOffsetMinutes(at: Date): number {
  const p = Object.fromEntries(appPartsFormat.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/**
 * A wall-clock time typed in Pacific ("YYYY-MM-DDTHH:mm", what a
 * datetime-local input sends) as a UTC ISO instant. The server runs in UTC, so
 * reading that string with `new Date()` would book a 10am call at 3am.
 */
export function pacificWallToIso(wall: string): string | null {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess - zoneOffsetMinutes(new Date(guess)) * 60000;
  t = guess - zoneOffsetMinutes(new Date(t)) * 60000; // settle across a DST change
  return new Date(t).toISOString();
}

/** An instant as the Pacific wall clock a datetime-local input shows. */
export function isoToPacificWall(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(appPartsFormat.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const appDateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Tue, Oct 6, 10:00 AM PT" - a meeting time, always in the company zone. */
export function formatPacificDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${appDateTimeFormat.format(d)} PT`;
}

/** Today's calendar date in the company zone, as "YYYY-MM-DD". */
export function todayYMD(now: Date = new Date()): string {
  return dayOf(now) as string;
}

/** Today (the company zone's calendar day) at local midnight. */
export function today(now: Date = new Date()): Date {
  return parseDate(todayYMD(now)) as Date;
}

/** Whole calendar days from today until `value` (negative = in the past). */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const target = value instanceof Date ? value : parseDate(value);
  if (!target) return null;
  const ms = target.getTime() - today().getTime();
  return Math.round(ms / 86_400_000);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Jun 16, 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return "—";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Jun 16" */
export function formatShortDate(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return "—";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Jun 16 – 19, 2026" / "Jun 28 – Jul 2, 2026" / single date fallback. */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s && !e) return "Dates TBD";
  if (s && !e) return formatDate(s);
  if (!s && e) return formatDate(e);
  if (s && e) {
    const sameYear = s.getFullYear() === e.getFullYear();
    const sameMonth = sameYear && s.getMonth() === e.getMonth();
    if (sameMonth) {
      return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
    }
    if (sameYear) {
      return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return `${formatDate(s)} – ${formatDate(e)}`;
  }
  return "Dates TBD";
}

/**
 * "$1,250,000" (whole dollars) by default, or "$1,250.50" with `{ cents: true }`.
 * Returns "—" for null.
 */
export function formatCurrency(
  value: number | null | undefined,
  opts?: { cents?: boolean },
): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  }).format(value);
}

/** Human countdown: "in 3 days", "today", "tomorrow", "2 days ago". */
export function formatCountdown(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}
