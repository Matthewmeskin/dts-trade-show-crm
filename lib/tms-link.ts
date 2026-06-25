/**
 * Auto-link helpers for the TMS sync: match a shipment's captured venue text to
 * an EXISTING venue, and pick the show at that venue. Linking only (never
 * creates records) so the sync can't mint junk venues/shows from messy text —
 * creation stays in the reviewed Suggestions flow.
 */
import { matchVenue, type VenueLite } from "@/lib/venue-match";

export type ShowLite = {
  id: string;
  venue_id: string | null;
  archived: boolean;
  move_in_start: string | null;
  move_out_end: string | null;
  show_start_date: string | null;
  show_end_date: string | null;
};

/** Resolve an existing venue id from the raw show-side text. */
export function resolveVenueId(rawVenue: string | null | undefined, venues: VenueLite[]): string | undefined {
  if (!rawVenue) return undefined;
  return matchVenue(rawVenue, venues)?.id;
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Is the shipment date plausibly part of this show? Freight can arrive a few
 * weeks ahead (advance warehouse) and move out shortly after, so allow
 * [move-in − 21d, move-out + 7d]. Undated shows are treated as plausible.
 */
function plausible(date: string | null | undefined, s: ShowLite): boolean {
  if (!date) return true;
  const start = s.move_in_start ?? s.show_start_date;
  const end = s.move_out_end ?? s.show_end_date ?? start;
  if (!start) return true;
  const d = date.slice(0, 10);
  return d >= shift(start, -21) && d <= shift(end ?? start, 7);
}

/**
 * Pick the show for a venue: the single non-archived show there whose window is
 * plausible for the shipment's date. Undefined if zero or several qualify — so
 * a June shipment never auto-links to the venue's August show.
 */
export function resolveShowId(
  venueId: string | undefined,
  shipmentDate: string | null | undefined,
  shows: ShowLite[],
): string | undefined {
  if (!venueId) return undefined;
  const here = shows.filter((s) => s.venue_id === venueId && !s.archived && plausible(shipmentDate, s));
  return here.length === 1 ? here[0].id : undefined;
}
