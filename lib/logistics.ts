import type { Tables } from "@/lib/database.types";
import { todayYMD } from "@/lib/format";

/**
 * Publishing rules for the public show pages, kept in one place.
 *
 * Every rule here MIRRORS a rule the database already enforces. That is
 * deliberate and it is the point of the file: the database is the authority, and
 * these copies exist only so the UI can tell someone what is missing BEFORE they
 * press Verify, instead of turning the button into a coin flip that comes back
 * with a Postgres error. If the two ever disagree, the database wins and this
 * file is the bug.
 *
 * The three sources being mirrored:
 *   tradeshow.guard_verification()                  - the verify trigger
 *   tradeshow.show_public_logistics constraints     - verify needs a source
 *   showdata.effective_verification() (public side) - the 60-day stale rule
 */

export type Logistics = Tables<"show_public_logistics">;
export type Series = Tables<"show_series">;

/** The timezone allowlist, matching the check constraint on the table. */
export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
] as const;

export const SOURCE_TYPES = [
  { value: "official_kit", label: "Official exhibitor kit" },
  { value: "organizer_site", label: "Organizer site" },
  { value: "gsc_site", label: "GSC site" },
  { value: "phone_confirmation", label: "Phone confirmation" },
] as const;

/** How long a verified row stays fresh. Mirrors showdata.effective_verification(). */
export const STALE_AFTER_DAYS = 60;

export type EffectiveStatus = "none" | "draft" | "verified" | "stale";

export const STATUS_META: Record<
  EffectiveStatus,
  { label: string; badge: string; blurb: string }
> = {
  none: {
    label: "No logistics",
    badge: "bg-slate-100 text-slate-600",
    blurb: "Nothing recorded yet. This show has no public page.",
  },
  draft: {
    label: "Draft",
    badge: "bg-amber-100 text-amber-800",
    blurb: "Saved but not verified, so nothing is published from it.",
  },
  verified: {
    label: "Verified",
    badge: "bg-emerald-100 text-emerald-800",
    blurb: "Published in full, addresses included.",
  },
  stale: {
    label: "Stale",
    badge: "bg-orange-100 text-orange-800",
    blurb:
      "Over 60 days since it was checked. The page stays up with a notice, and the website hides the addresses until someone re-verifies.",
  },
};

/**
 * What the website will actually treat this row as, today.
 *
 * Mirrors showdata.effective_verification(): staleness is computed at read time,
 * never stored, so nothing can claim to be fresh because a job failed to run. A
 * show that has already happened never goes stale - it is history, not a
 * liability.
 */
export function effectiveStatus(
  logistics: Pick<Logistics, "verification_status" | "last_verified_at"> | null,
  showEndDate: string | null,
): EffectiveStatus {
  if (!logistics) return "none";
  if (logistics.verification_status !== "verified") {
    return (logistics.verification_status as EffectiveStatus) ?? "draft";
  }
  if (showEndDate && showEndDate < today()) return "verified";
  if (!logistics.last_verified_at) return "stale";
  return logistics.last_verified_at < cutoffIso() ? "stale" : "verified";
}

/** The date a verified row goes stale, or null if it is not verified. */
export function goesStaleOn(
  logistics: Pick<Logistics, "verification_status" | "last_verified_at"> | null,
): Date | null {
  if (!logistics || logistics.verification_status !== "verified") return null;
  if (!logistics.last_verified_at) return null;
  const d = new Date(logistics.last_verified_at);
  d.setUTCDate(d.getUTCDate() + STALE_AFTER_DAYS);
  return d;
}

function today(): string {
  return todayYMD();
}

function cutoffIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - STALE_AFTER_DAYS);
  return d.toISOString();
}

/** One thing standing between this show and a published page. */
export type Blocker = {
  field: string;
  message: string;
  /** Where the value is edited: this tab, the show's own fields, or the series. */
  fix: "logistics" | "show" | "series";
};

type ShowFields = Pick<
  Tables<"shows">,
  | "show_start_date"
  | "show_end_date"
  | "advance_warehouse_name"
  | "advance_warehouse_street1"
  | "direct_to_show_street1"
  | "advance_warehouse_address"
  | "direct_to_show_address"
  | "series_id"
>;

/**
 * Everything that would make Verify fail, in the order a person would fix it.
 *
 * Mirrors guard_verification() plus the table's verified_rows_carry_a_source
 * constraint. Returning this rather than letting the trigger raise is the whole
 * reason this function exists.
 */
export function verifyBlockers(
  show: ShowFields,
  draft: {
    timezone: string | null;
    source_url: string | null;
    source_type: string | null;
  },
): Blocker[] {
  const out: Blocker[] = [];

  if (!show.show_start_date || !show.show_end_date) {
    out.push({
      field: "show_dates",
      fix: "show",
      message: "The edition needs a start and end date.",
    });
  }

  if (!draft.timezone) {
    out.push({
      field: "timezone",
      fix: "logistics",
      message: "Set the timezone, or every date on the page is ambiguous.",
    });
  }

  const hasAdvance = Boolean(
    show.advance_warehouse_name && show.advance_warehouse_street1,
  );
  const hasDirect = Boolean(show.direct_to_show_street1);
  if (!hasAdvance && !hasDirect) {
    const legacy = show.advance_warehouse_address || show.direct_to_show_address;
    out.push({
      field: "freight_address",
      fix: "show",
      message: legacy
        ? "This show still has its address as one line. Split it into street, city, state and zip on the Overview tab — the page needs the parts."
        : "A published page needs an advance warehouse with a street, or a direct-to-show street.",
    });
  }

  if (!draft.source_url) {
    out.push({
      field: "source_url",
      fix: "logistics",
      message: "Verifying records where you checked. Paste the source URL.",
    });
  }
  if (!draft.source_type) {
    out.push({
      field: "source_type",
      fix: "logistics",
      message: "Say what kind of source that is.",
    });
  }

  return out;
}

/** What still stands between a verified row and a live page. */
export function publishBlockers(
  show: ShowFields,
  series: Series | null,
): Blocker[] {
  const out: Blocker[] = [];
  if (!show.series_id || !series) {
    out.push({
      field: "series",
      fix: "series",
      message:
        "This edition is not attached to a show yet, so there is no page URL for it.",
    });
    return out;
  }
  if (!series.is_public) {
    out.push({
      field: "is_public",
      fix: "series",
      message: "The show is not published, so its page is not live.",
    });
  }
  return out;
}

/**
 * Turn a show name into a URL slug candidate.
 *
 * Only ever a suggestion for a person to accept or change: the slug is the one
 * thing on a show page that can never be changed once it has ranked, and no
 * normaliser knows that "IFT" and "IFT FIRST" are different shows.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Matches the slug_is_url_shaped check constraint. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Big shows get their own public page first: they carry the most exhibitors,
 * so they are the pages partners (GSCs, exhibit houses) actually hand out.
 */
export const BIG_SHOW_MIN_EXHIBITORS = 250;

export function isBigShow(exhibitorCount: number | null | undefined): boolean {
  return (exhibitorCount ?? 0) >= BIG_SHOW_MIN_EXHIBITORS;
}

/**
 * A starting timezone for a draft, from the venue's state. Only a suggestion:
 * it lands in a draft a person reviews before Verify. States split across two
 * zones map to where their convention centers are (Indianapolis is Eastern,
 * El Paso aside Texas is Central, and so on).
 */
const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Denver", IL: "America/Chicago", IN: "America/New_York", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};

export function timezoneForState(state: string | null | undefined): string | null {
  if (!state) return null;
  return STATE_TZ[state.trim().toUpperCase()] ?? null;
}

type ReadinessShow = ShowFields & {
  exhibitor_manual_url: string | null;
};

/** One line of the big show checklist: what a person still has to supply. */
export type ReadinessItem = { key: string; label: string; done: boolean };

/**
 * How close a show is to a live page, as a short checklist the publishing
 * queue can print beside it. Built from the same rules as verifyBlockers and
 * publishBlockers so it can never promise more than Verify will accept.
 */
export function pageReadiness(
  show: ReadinessShow,
  draft: { timezone: string | null; source_url: string | null; source_type: string | null } | null,
  series: Pick<Series, "is_public"> | null,
): ReadinessItem[] {
  const blockers = new Set(
    verifyBlockers(show, draft ?? { timezone: null, source_url: null, source_type: null }).map((b) => b.field),
  );
  return [
    { key: "dates", label: "Dates", done: !blockers.has("show_dates") },
    { key: "address", label: "Freight address", done: !blockers.has("freight_address") },
    { key: "kit", label: "Exhibitor kit", done: Boolean(show.exhibitor_manual_url) },
    { key: "draft", label: "Draft", done: Boolean(draft) },
    { key: "series", label: "Page URL", done: Boolean(show.series_id) },
    { key: "public", label: "Published", done: Boolean(series?.is_public) },
  ];
}
