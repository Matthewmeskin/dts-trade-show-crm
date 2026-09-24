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
