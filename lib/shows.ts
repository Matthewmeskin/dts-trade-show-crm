import type { Tables } from "@/lib/database.types";
import { daysUntil } from "@/lib/format";

export type ShowWithStatus = Tables<"shows_with_status">;
export type ShowStatus = NonNullable<ShowWithStatus["status"]>;

export const SHOW_STATUS_META: Record<
  ShowStatus,
  { label: string; dot: string; badge: string; bar: string }
> = {
  upcoming: {
    label: "Upcoming",
    dot: "bg-dts-blue",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
    bar: "bg-dts-blue",
  },
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    bar: "bg-emerald-500",
  },
  completed: {
    label: "Completed",
    dot: "bg-dts-midgrey",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
    bar: "bg-dts-midgrey",
  },
  archived: {
    label: "Archived",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    bar: "bg-amber-500",
  },
};

/** Date a show "starts" for ordering: advance warehouse open, else move-in. */
function showStart(s: ShowWithStatus): string | null {
  return s.advance_warehouse_open ?? s.move_in_start ?? null;
}

/**
 * The dashboard's featured show: the active show with the earliest move-out
 * (so the most time-critical surfaces first when several run at once); if none
 * are active, the soonest upcoming show.
 */
export function pickFeaturedShow<T extends ShowWithStatus>(
  shows: T[],
): T | null {
  const active = shows
    .filter((s) => s.status === "active")
    .sort(
      (a, b) =>
        (daysUntil(a.move_out_end) ?? Infinity) -
        (daysUntil(b.move_out_end) ?? Infinity),
    );
  if (active.length) return active[0];

  const upcoming = shows
    .filter((s) => s.status === "upcoming")
    .sort(
      (a, b) =>
        (daysUntil(showStart(a)) ?? Infinity) -
        (daysUntil(showStart(b)) ?? Infinity),
    );
  return upcoming[0] ?? null;
}

/** Upcoming shows sorted soonest-first (for the dashboard strip / calendar). */
export function sortUpcoming<T extends ShowWithStatus>(shows: T[]): T[] {
  return shows
    .filter((s) => s.status === "upcoming")
    .sort(
      (a, b) =>
        (daysUntil(showStart(a)) ?? Infinity) -
        (daysUntil(showStart(b)) ?? Infinity),
    );
}

export type Deadline = { label: string; date: string; days: number };

/**
 * The next critical deadline for a show — advance warehouse cutoff, move-in
 * start, or move-out end, whichever comes next (today or later).
 */
export function nextCriticalDeadline(s: ShowWithStatus): Deadline | null {
  const candidates: { label: string; date: string | null }[] = [
    { label: "Advance warehouse cutoff", date: s.advance_warehouse_cutoff },
    { label: "Move-in starts", date: s.move_in_start },
    { label: "Move-out ends", date: s.move_out_end },
  ];

  return candidates
    .map((c) => ({ label: c.label, date: c.date, days: daysUntil(c.date) }))
    .filter(
      (c): c is Deadline =>
        c.date != null && c.days != null && c.days >= 0,
    )
    .sort((a, b) => a.days - b.days)[0] ?? null;
}
