import type { EffectiveStatus } from "@/lib/logistics";

/**
 * GSC Shipping Centers: the rules the CRM screens share.
 *
 * A Shipping Center runs only on shows the GSC itself runs. The CRM records the
 * GSC of a show in `shows.decorator` (free text, filled by hand or by the kit
 * reader), so "does this GSC run this show" is a name comparison, made loose
 * enough that "A Classic Expo Design" matches "A Classic Expo Design (BRI,
 * Inc.)" and strict enough that another contractor never matches.
 */

const SUFFIXES = /\b(inc|llc|l\.l\.c|co|corp|corporation|company|ltd|lp|llp|incorporated)\b\.?/g;

/** A company name reduced to the words that identify it. */
export function normalizeCompany(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // "(BRI, Inc.)", "(SoCal)"
    .replace(/&/g, " and ")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Whether the GSC named on a show is this partner. A blank GSC is not a match:
 * the caller asks the person to set it rather than assuming.
 */
export function gscMatches(
  decorator: string | null | undefined,
  partner: { name: string; public_name?: string | null },
): boolean {
  const d = normalizeCompany(decorator);
  if (!d) return false;
  return [partner.public_name, partner.name]
    .map(normalizeCompany)
    .filter((n) => n.length >= 3)
    .some((n) => n === d || n.startsWith(`${d} `) || d.startsWith(`${n} `));
}

/** The name to record as a show's GSC when this partner runs it. */
export function gscNameFor(partner: { name: string; public_name?: string | null }): string {
  return (partner.public_name || partner.name).trim();
}

export type ShipShowState = "past" | "on" | "on_stale" | "on_hidden" | "ready" | "reconfirm" | "setup";

export type ShipShowStatus = {
  state: ShipShowState;
  label: string;
  badge: string;
  /** One line under the label, saying what it means for exhibitors. */
  detail: string;
  /** The one thing to do next, if anything. */
  action: "turn_off" | "turn_on" | "set_up" | "reconfirm" | null;
};

/**
 * One status and one next step per show, from whether it is switched on and
 * where its freight details stand. Mirrors what the public project will show:
 * only verified or stale details are listed, and a stale show hides addresses
 * and labels until someone reconfirms.
 */
export function shipShowStatus(
  enabled: boolean,
  details: EffectiveStatus,
  showEndDate: string | null,
  today: string,
): ShipShowStatus {
  if (showEndDate && showEndDate < today) {
    return { state: "past", label: "Show is over", badge: "bg-slate-100 text-slate-500", detail: "Nothing to do.", action: null };
  }
  if (enabled && details === "verified") {
    return { state: "on", label: "On", badge: "bg-emerald-100 text-emerald-800", detail: "Exhibitors can request shipping.", action: "turn_off" };
  }
  if (enabled && details === "stale") {
    return {
      state: "on_stale",
      label: "On, needs reconfirming",
      badge: "bg-orange-100 text-orange-800",
      detail: "Checked over 60 days ago, so addresses and labels are hidden until someone reconfirms.",
      action: "reconfirm",
    };
  }
  if (enabled) {
    return {
      state: "on_hidden",
      label: "On, but not showing",
      badge: "bg-amber-100 text-amber-800",
      detail: "Switched on, but exhibitors can't see it until the details are verified.",
      action: "set_up",
    };
  }
  if (details === "verified") {
    return { state: "ready", label: "Ready", badge: "bg-sky-100 text-sky-800", detail: "Details verified. Turn it on when the GSC is ready.", action: "turn_on" };
  }
  if (details === "stale") {
    return {
      state: "reconfirm",
      label: "Needs reconfirming",
      badge: "bg-orange-100 text-orange-800",
      detail: "Checked over 60 days ago. Reconfirm against the kit before turning it on.",
      action: "reconfirm",
    };
  }
  return { state: "setup", label: "Needs setup", badge: "bg-slate-100 text-slate-700", detail: "Add the dates and where freight goes, then verify.", action: "set_up" };
}

/** Where exhibitors will find the show (the /ship pages arrive in slice 3). */
export function shipPath(code: string, seriesSlug: string, year: number | null): string {
  return `/ship/${code}/${seriesSlug}/${year ?? ""}`.replace(/\/$/, "");
}

/** A show name without a trailing year, as the evergreen name for its web address. */
export function evergreenName(showName: string): string {
  return showName.replace(/\s*\b(19|20)\d{2}\b\s*$/, "").trim() || showName.trim();
}
