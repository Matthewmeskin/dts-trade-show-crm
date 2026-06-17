"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

export type VenueFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function parseVenue(fd: FormData): {
  data?: TablesInsert<"venues">;
  fieldErrors?: Record<string, string>;
} {
  const venue_name = str(fd, "venue_name");
  if (!venue_name) return { fieldErrors: { venue_name: "Venue name is required." } };

  return {
    data: {
      venue_name,
      city: str(fd, "city"),
      state: str(fd, "state"),
      address: str(fd, "address"),
      dock_notes: str(fd, "dock_notes"),
      union_rules: str(fd, "union_rules"),
      delivery_restrictions: str(fd, "delivery_restrictions"),
      parking_and_staging_notes: str(fd, "parking_and_staging_notes"),
      general_notes: str(fd, "general_notes"),
    },
  };
}

export async function createVenue(
  _prev: VenueFormState,
  fd: FormData,
): Promise<VenueFormState> {
  const { data, fieldErrors } = parseVenue(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("venues")
    .insert(data!)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/venues");
  redirect(`/venues/${row.id}`);
}

export async function updateVenue(
  _prev: VenueFormState,
  fd: FormData,
): Promise<VenueFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing venue id." };

  const { data, fieldErrors } = parseVenue(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("venues").update(data!).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/venues");
  revalidatePath(`/venues/${id}`);
  redirect(`/venues/${id}`);
}

export async function deleteVenue(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // shows.venue_id is ON DELETE SET NULL, so shows are preserved.
  await supabase.from("venues").delete().eq("id", id);
  revalidatePath("/venues");
  redirect("/venues");
}
