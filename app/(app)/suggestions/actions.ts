"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { matchVenue } from "@/lib/venue-match";
import type { TablesInsert } from "@/lib/database.types";

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const intVal = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const idList = (fd: FormData) =>
  String(fd.get("shipment_ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Link a set of shipments to an existing venue. */
export async function linkShipmentsToVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const ids = idList(fd);
  if (!venue_id || !ids.length) return;
  const supabase = await createClient();
  await supabase.from("shipments").update({ venue_id }).in("id", ids);
  revalidatePath("/suggestions");
  revalidatePath("/venues");
}

/**
 * Create a venue and link the cluster's shipments — but reuse an existing venue
 * if one already matches (don't create duplicates). Prefers a same-state match.
 */
export async function createVenueAndLink(
  fd: FormData,
): Promise<{ error: string | null; venueId?: string; matched?: boolean }> {
  const venue_name = str(fd, "venue_name");
  if (!venue_name) return { error: "Venue name is required." };
  const ids = idList(fd);
  const state = str(fd, "state");

  const supabase = await createClient();
  const { data: existing } = await supabase.from("venues").select("id, venue_name, city, state");
  const pool = existing ?? [];
  const inState = state ? pool.filter((v) => (v.state ?? "").toLowerCase() === state.toLowerCase()) : [];
  const dup = matchVenue(venue_name, inState) ?? matchVenue(venue_name, pool);

  let venueId = dup?.id;
  if (!venueId) {
    const payload: TablesInsert<"venues"> = {
      venue_name,
      address: str(fd, "address"),
      city: str(fd, "city"),
      state,
    };
    const { data: venue, error } = await supabase.from("venues").insert(payload).select("id").single();
    if (error) return { error: error.message };
    venueId = venue.id;
  }

  if (ids.length) await supabase.from("shipments").update({ venue_id: venueId }).in("id", ids);
  revalidatePath("/suggestions");
  revalidatePath("/venues");
  return { error: null, venueId, matched: !!dup };
}

/**
 * Create a show and link the cluster's shipments — but reuse an existing show
 * with the same name (and venue/year when known) instead of duplicating.
 */
export async function createShowAndLink(fd: FormData): Promise<{ error: string | null; matched?: boolean }> {
  const show_name = str(fd, "show_name");
  if (!show_name) return { error: "Show name is required." };
  const ids = idList(fd);
  const venue_id = str(fd, "venue_id");
  const edition_year = intVal(fd, "edition_year");

  const supabase = await createClient();
  const { data: existingShows } = await supabase.from("shows").select("id, show_name, venue_id, edition_year");
  const target = normName(show_name);
  const dup = (existingShows ?? []).find(
    (sh) =>
      normName(sh.show_name) === target &&
      (venue_id ? sh.venue_id === venue_id : true) &&
      (edition_year ? sh.edition_year === edition_year : true),
  );
  if (dup) {
    if (ids.length) await supabase.from("shipments").update({ show_id: dup.id }).in("id", ids);
    revalidatePath("/suggestions");
    revalidatePath("/shows");
    return { error: null, matched: true };
  }

  const payload: TablesInsert<"shows"> = {
    show_name,
    edition_year,
    venue_id,
    website_url: str(fd, "website_url"),
    exhibitor_manual_url: str(fd, "exhibitor_manual_url"),
    exhibitor_list_url: str(fd, "exhibitor_list_url"),
    show_start_date: str(fd, "show_start_date"),
    show_end_date: str(fd, "show_end_date"),
    move_in_start: str(fd, "move_in_start"),
    move_out_end: str(fd, "move_out_end"),
  };
  const { data: show, error } = await supabase.from("shows").insert(payload).select("id").single();
  if (error) return { error: error.message };
  if (ids.length) await supabase.from("shipments").update({ show_id: show.id }).in("id", ids);
  revalidatePath("/suggestions");
  revalidatePath("/shows");
  return { error: null };
}
