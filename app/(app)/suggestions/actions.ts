"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

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

/** Create a venue from suggested/AI fields and link the cluster's shipments. */
export async function createVenueAndLink(
  fd: FormData,
): Promise<{ error: string | null; venueId?: string }> {
  const venue_name = str(fd, "venue_name");
  if (!venue_name) return { error: "Venue name is required." };
  const ids = idList(fd);

  const supabase = await createClient();
  const payload: TablesInsert<"venues"> = {
    venue_name,
    address: str(fd, "address"),
    city: str(fd, "city"),
    state: str(fd, "state"),
  };
  const { data: venue, error } = await supabase.from("venues").insert(payload).select("id").single();
  if (error) return { error: error.message };
  if (ids.length) await supabase.from("shipments").update({ venue_id: venue.id }).in("id", ids);
  revalidatePath("/suggestions");
  revalidatePath("/venues");
  return { error: null, venueId: venue.id };
}

/** Create a show from suggested/AI fields and link the cluster's shipments. */
export async function createShowAndLink(fd: FormData): Promise<{ error: string | null }> {
  const show_name = str(fd, "show_name");
  if (!show_name) return { error: "Show name is required." };
  const ids = idList(fd);

  const supabase = await createClient();
  const payload: TablesInsert<"shows"> = {
    show_name,
    edition_year: intVal(fd, "edition_year"),
    venue_id: str(fd, "venue_id"),
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
