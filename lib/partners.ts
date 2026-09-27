import type { Tables } from "@/lib/database.types";
import { dayOf, todayYMD } from "@/lib/format";
import { shiftDays } from "@/lib/sales";

/**
 * The partner growth plan, as rules the CRM can hold people to.
 *
 * Win the companies that control freight for many exhibitors at once. The
 * sales admin works a warm-signal list, books qualified calls onto a rep's
 * calendar with a handoff note, and the rep closes the loop within 24 hours.
 * The database enforces the qualification bar and the held-needs-outcome rule
 * (0040); these copies let the UI say what's missing before it tries to save.
 */

export type Partner = Tables<"partners">;
export type PartnerCall = Tables<"partner_calls">;
export type PartnerSignal = Tables<"partner_signals">;
export type PartnerTouch = Tables<"partner_touches">;

export const PARTNER_TYPES = [
  { value: "exhibit_house", label: "Exhibit house / builder", short: "Exhibit house" },
  { value: "gsc", label: "Independent / regional GSC", short: "GSC" },
  { value: "organizer", label: "Association show organizer", short: "Organizer" },
  { value: "agency", label: "I&D / experiential agency", short: "I&D / agency" },
  { value: "other", label: "Other", short: "Other" },
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number]["value"];

/** What we ask each kind of partner for (from the plan's ranking). */
export const PARTNER_ASK: Record<PartnerType, string> = {
  exhibit_house: "A pilot on 3 clients at one show, then the whole book.",
  gsc: "Recommended shipping option in the exhibitor kit, plus referrals.",
  organizer: "Recommended shipping partner listing and a cobranded show page.",
  agency: "Referrals.",
  other: "Referrals.",
};

export const TIERS = [
  { value: 1, label: "Tier 1", badge: "bg-dts-maroon text-white" },
  { value: 2, label: "Tier 2", badge: "bg-dts-maroon/15 text-dts-maroon" },
  { value: 3, label: "Tier 3", badge: "bg-slate-100 text-slate-600" },
] as const;

export const STAGES = [
  { value: "target", label: "Target", badge: "bg-slate-100 text-slate-600" },
  { value: "working", label: "Working", badge: "bg-sky-50 text-sky-700" },
  { value: "conversation", label: "Conversation", badge: "bg-sky-100 text-sky-800" },
  { value: "qualified", label: "Qualified", badge: "bg-indigo-100 text-indigo-800" },
  { value: "booked", label: "Call booked", badge: "bg-violet-100 text-violet-800" },
  { value: "held", label: "Call held", badge: "bg-violet-200 text-violet-900" },
  { value: "pilot", label: "Pilot", badge: "bg-amber-100 text-amber-800" },
  { value: "full_book", label: "Full book", badge: "bg-emerald-100 text-emerald-800" },
  { value: "nurture", label: "Nurture", badge: "bg-slate-100 text-slate-500" },
  { value: "not_fit", label: "Not a fit", badge: "bg-slate-100 text-slate-400 line-through" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];

export const SIGNAL_TYPES = [
  { value: "show_page", label: "Show page visit" },
  { value: "quote_request", label: "Quote request" },
  { value: "checklist_download", label: "Checklist download" },
  { value: "website_visit", label: "Website visit (Apollo)" },
  { value: "exhibitor_list", label: "Clients on an exhibitor list" },
  { value: "outreach_reply", label: "Reply / click (Smartlead, LinkedIn)" },
  { value: "event", label: "Met at an event" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export const CHANNELS = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
] as const;

export const OUTCOMES = [
  { value: "good_fit", label: "Good fit", badge: "bg-emerald-100 text-emerald-800" },
  { value: "next_step", label: "Next step", badge: "bg-sky-100 text-sky-800" },
  { value: "not_fit", label: "Not a fit", badge: "bg-slate-100 text-slate-500" },
] as const;

export const CALL_STATUSES = [
  { value: "booked", label: "Booked" },
  { value: "held", label: "Held" },
  { value: "no_show", label: "No-show" },
  { value: "canceled", label: "Canceled" },
] as const;

export const labelOf = <T extends { value: string | number; label: string }>(
  list: readonly T[],
  v: string | number | null | undefined,
) => list.find((x) => x.value === v)?.label ?? (v == null ? "—" : String(v));

export const metaOf = <T extends { value: string | number }>(list: readonly T[], v: string | number | null | undefined) =>
  list.find((x) => x.value === v);

/** Weekly targets from the plan. Adjust after 30 days. */
export const WEEKLY_TARGETS = {
  worked: [60, 80],
  conversations: [10, 15],
  booked: [3, 5],
  showRate: 0.75,
} as const;

/** How long a rep has to record the outcome after a call. */
export const OUTCOME_DUE_HOURS = 24;
/** "A show in the next 120 days" - the second qualification rule. */
export const QUALIFY_SHOW_WINDOW_DAYS = 120;

// ---------------------------------------------------------------------------
// Qualification
// ---------------------------------------------------------------------------

export type Qualification = {
  influence: boolean;
  showSoon: boolean;
  /** The one rule only the admin can know: they picked the time themselves. */
  agreedTime: null;
  /** The partner's next show inside the window, if any. */
  nextShow: { name: string; start: string } | null;
};

/**
 * What the CRM can tell about the bar before the admin ticks it. Influence:
 * at least 3 exhibitors, or a GSC or organizer. Show soon: a linked show
 * starting in the next 120 days.
 */
export function suggestQualification(
  partner: Pick<Partner, "partner_type" | "client_count">,
  shows: { name: string; start: string | null }[],
  today: string = todayYMD(),
): Qualification {
  const influence =
    partner.partner_type === "gsc" || partner.partner_type === "organizer" || (partner.client_count ?? 0) >= 3;
  const horizon = shiftDays(today, QUALIFY_SHOW_WINDOW_DAYS)!;
  const upcoming = shows
    .filter((s): s is { name: string; start: string } => !!s.start && s.start >= today && s.start <= horizon)
    .sort((a, b) => a.start.localeCompare(b.start));
  return { influence, showSoon: upcoming.length > 0, agreedTime: null, nextShow: upcoming[0] ?? null };
}

/** Why a booking would be refused, in words for the admin. Mirrors partner_calls_qualified. */
export function bookingBlockers(input: {
  q_influence: boolean;
  q_show_120: boolean;
  q_agreed_time: boolean;
  signal: string;
  shows_note: string;
  shipping_pain: string;
  rep_id: string;
  scheduled_at: string;
}): string[] {
  const out: string[] = [];
  if (!input.q_influence) out.push("They must influence freight for at least 3 exhibitors, or be a GSC or organizer.");
  if (!input.q_show_120) out.push("They need a show in the next 120 days.");
  if (!input.q_agreed_time) out.push("They have to agree to the time themselves — \"send me info\" is a touch, not a call.");
  if (!input.rep_id) out.push("Pick the rep the call is with.");
  if (!input.scheduled_at) out.push("Set the call time.");
  if (!input.signal.trim()) out.push("Handoff note: what signal brought them in?");
  if (!input.shows_note.trim()) out.push("Handoff note: which shows, and how many clients at each?");
  if (!input.shipping_pain.trim()) out.push("Handoff note: what's their shipping pain today?");
  return out;
}

// ---------------------------------------------------------------------------
// The rep's 24-hour loop
// ---------------------------------------------------------------------------

export type LoopState = "upcoming" | "due" | "overdue" | "closed";

/**
 * Where a booked call stands on the rep's loop. After the call time the rep
 * owes an outcome; past 24 hours it's overdue.
 */
export function loopState(
  call: Pick<PartnerCall, "status" | "scheduled_at" | "outcome">,
  now: Date = new Date(),
): LoopState {
  if (call.status === "canceled" || call.status === "no_show") return "closed";
  if (call.status === "held" && call.outcome) return "closed";
  const at = new Date(call.scheduled_at).getTime();
  if (now.getTime() < at) return "upcoming";
  return now.getTime() - at > OUTCOME_DUE_HOURS * 3600_000 ? "overdue" : "due";
}

// ---------------------------------------------------------------------------
// Weekly numbers (Monday to Sunday, Pacific)
// ---------------------------------------------------------------------------

/** The Monday that starts the Pacific week containing `today` (YYYY-MM-DD). */
export function weekStart(today: string = todayYMD()): string {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 Sunday
  return shiftDays(today, dow === 0 ? -6 : 1 - dow)!;
}

export type WeeklyNumbers = {
  /** Distinct partners touched this week. */
  worked: number;
  /** Touches that reached a person. */
  conversations: number;
  /** Qualified calls booked this week (every saved call cleared the bar). */
  booked: number;
  /** Calls held this week, by call time. The admin's number. */
  held: number;
  /** held / (held + no-show) for calls due this week, or null with nothing to measure. */
  showRate: number | null;
  /** Calls whose outcome is past the 24-hour mark. */
  overdueOutcomes: number;
};

export function weeklyNumbers(
  touches: Pick<PartnerTouch, "partner_id" | "reached" | "occurred_at">[],
  calls: Pick<PartnerCall, "created_at" | "scheduled_at" | "status" | "outcome">[],
  today: string = todayYMD(),
  now: Date = new Date(),
): WeeklyNumbers {
  const start = weekStart(today);
  const end = shiftDays(start, 7)!;
  const inWeek = (ts: string) => {
    const d = dayOf(ts);
    return !!d && d >= start && d < end;
  };
  const weekTouches = touches.filter((t) => inWeek(t.occurred_at));
  const due = calls.filter((c) => inWeek(c.scheduled_at));
  const held = due.filter((c) => c.status === "held").length;
  const noShow = due.filter((c) => c.status === "no_show").length;
  return {
    worked: new Set(weekTouches.map((t) => t.partner_id)).size,
    conversations: weekTouches.filter((t) => t.reached).length,
    booked: calls.filter((c) => inWeek(c.created_at)).length,
    held,
    showRate: held + noShow ? held / (held + noShow) : null,
    overdueOutcomes: calls.filter((c) => loopState(c, now) === "overdue").length,
  };
}

// ---------------------------------------------------------------------------
// Import: a pasted spreadsheet becomes the target list
// ---------------------------------------------------------------------------

export type ImportRow = {
  name: string;
  partner_type: PartnerType;
  tier: number | null;
  website: string | null;
  city: string | null;
  state: string | null;
  client_count: number | null;
  source: string | null;
  notes: string | null;
};

const HEADER_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["name", "company", "company name", "partner", "account", "account name"],
  partner_type: ["type", "partner type", "category"],
  tier: ["tier", "priority"],
  website: ["website", "url", "domain", "web"],
  city: ["city"],
  state: ["state", "st", "province"],
  client_count: ["clients", "client count", "exhibitors", "# clients", "number of clients", "accounts"],
  source: ["source", "list", "found via"],
  notes: ["notes", "note", "comments", "why"],
};

/** Split one CSV / TSV line, honouring quotes. */
export function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parsePartnerType(v: string): PartnerType {
  const s = v.toLowerCase();
  if (/gsc|general service|contractor|decorator/.test(s)) return "gsc";
  if (/organi[sz]er|association|show management/.test(s)) return "organizer";
  if (/i&d|i ?& ?d|install|experiential|agency/.test(s)) return "agency";
  if (/exhibit|builder|booth|fabricat/.test(s)) return "exhibit_house";
  return s ? "other" : "exhibit_house";
}

/**
 * Parse a pasted sheet (header row first; commas or tabs) into partner rows.
 * Needs a name column; everything else is optional. Rows without a name are
 * reported, not guessed at.
 */
export function parseImport(text: string): { rows: ImportRow[]; problems: string[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return { rows: [], problems: ["Paste a header row and at least one company."] };
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const header = splitLine(lines[0], sep).map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const col = {} as Record<keyof ImportRow, number>;
  for (const key of Object.keys(HEADER_ALIASES) as (keyof ImportRow)[]) {
    col[key] = header.findIndex((h) => HEADER_ALIASES[key].includes(h));
  }
  if (col.name < 0) return { rows: [], problems: ["No company name column. Name one of the headers \"Company\" or \"Name\"."] };

  const rows: ImportRow[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line, sep);
    const get = (k: keyof ImportRow) => (col[k] >= 0 ? (cells[col[k]] ?? "").trim() : "");
    const name = get("name");
    if (!name) {
      problems.push(`Row ${i + 2}: no company name — skipped.`);
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      problems.push(`Row ${i + 2}: ${name} appears twice — kept the first.`);
      return;
    }
    seen.add(key);
    const tierRaw = get("tier").replace(/[^0-9]/g, "");
    const tier = tierRaw ? Number(tierRaw) : null;
    const clientsRaw = get("client_count").replace(/[^0-9]/g, "");
    rows.push({
      name,
      partner_type: parsePartnerType(get("partner_type")),
      tier: tier && tier >= 1 && tier <= 3 ? tier : null,
      website: normalizeWebsite(get("website")),
      city: get("city") || null,
      state: get("state") || null,
      client_count: clientsRaw ? Number(clientsRaw) : null,
      source: get("source") || null,
      notes: get("notes") || null,
    });
  });
  return { rows, problems };
}

export function normalizeWebsite(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s) ? `https://${s}` : null;
}

// ---------------------------------------------------------------------------
// Stage moves the CRM makes on its own
// ---------------------------------------------------------------------------

const FUNNEL: Stage[] = ["target", "working", "conversation", "qualified", "booked", "held", "pilot", "full_book"];

/**
 * Move a partner forward when something happens (a touch, a booked call) -
 * never backward, and never out of Nurture or Not a fit on its own. Those are
 * a person's call.
 */
export function advanceStage(current: string, to: Stage): Stage | null {
  const from = FUNNEL.indexOf(current as Stage);
  const next = FUNNEL.indexOf(to);
  if (from < 0 || next < 0) return null;
  return next > from ? to : null;
}

// ---------------------------------------------------------------------------
// Partner terms and the stack check
// ---------------------------------------------------------------------------

/** The plan's starting rebate range to test, as a share of gross margin. */
export const REBATE_TEST_RANGE = [10, 20] as const;
/** What DTS must keep on every deal after rebate and rep commission. */
export const STACK_FLOOR_DOLLARS = 30;
export const STACK_FLOOR_SHARE = 0.5;

export type StackCheck = {
  rebate: number;
  commission: number;
  dtsKeeps: number;
  keepsShare: number;
  /** Keeps at least $30 AND at least half the margin. */
  ok: boolean;
  reasons: string[];
};

/**
 * "Rebate plus rep commission must still leave DTS at least $30 or 50% of the
 * margin." Read strictly: DTS must keep both - $30 and half - so a thin load
 * and a big rebate each fail on their own. Commission is on the margin before
 * or after the rebate, whichever the partner agreement says.
 */
export function stackCheck(input: {
  margin: number;
  rebatePct: number;
  commissionPct: number;
  commissionBasis: "before_rebate" | "after_rebate";
}): StackCheck {
  const margin = Math.max(0, input.margin);
  const rebate = round2((margin * Math.max(0, input.rebatePct)) / 100);
  const base = input.commissionBasis === "after_rebate" ? margin - rebate : margin;
  const commission = round2((Math.max(0, base) * Math.max(0, input.commissionPct)) / 100);
  const dtsKeeps = round2(margin - rebate - commission);
  const keepsShare = margin > 0 ? dtsKeeps / margin : 0;
  const reasons: string[] = [];
  if (dtsKeeps < STACK_FLOOR_DOLLARS) reasons.push(`DTS keeps $${dtsKeeps.toFixed(2)}, under the $${STACK_FLOOR_DOLLARS} floor.`);
  if (keepsShare < STACK_FLOOR_SHARE) reasons.push(`DTS keeps ${Math.round(keepsShare * 100)}% of the margin, under 50%.`);
  return { rebate, commission, dtsKeeps, keepsShare, ok: reasons.length === 0, reasons };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A starting code from the company name: "Pacific Exhibit Services, Inc." → "pacific-exhibit-services". */
export function suggestCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const PARTNER_CODE_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PUBLIC_SITE = "https://www.dtsone.com";
export const cobrandUrl = (showSlug: string, code: string) => `${PUBLIC_SITE}/trade-show/shipping/${showSlug}/with/${code}`;
