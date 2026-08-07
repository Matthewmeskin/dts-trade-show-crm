"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity, diffPayload, VENUE_FIELD_LABELS } from "@/lib/activity";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";

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

/**
 * Save AI-discovered logistics onto a venue. Only writes the fields provided
 * (the client sends what the user accepted) and never blanks an existing field.
 */
export async function applyVenueLogistics(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const patch: TablesUpdate<"venues"> = {
    ...(str(fd, "address") ? { address: str(fd, "address") } : {}),
    ...(str(fd, "city") ? { city: str(fd, "city") } : {}),
    ...(str(fd, "state") ? { state: str(fd, "state") } : {}),
    ...(str(fd, "dock_notes") ? { dock_notes: str(fd, "dock_notes") } : {}),
    ...(str(fd, "union_rules") ? { union_rules: str(fd, "union_rules") } : {}),
    ...(str(fd, "delivery_restrictions") ? { delivery_restrictions: str(fd, "delivery_restrictions") } : {}),
    ...(str(fd, "parking_and_staging_notes") ? { parking_and_staging_notes: str(fd, "parking_and_staging_notes") } : {}),
    ...(str(fd, "general_notes") ? { general_notes: str(fd, "general_notes") } : {}),
  };
  if (Object.keys(patch).length === 0) return;
  const supabase = await createClient();
  await supabase.from("venues").update(patch).eq("id", id);
  revalidatePath(`/venues/${id}`);
  revalidatePath("/venues");
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

  await logActivity(supabase, {
    action: "created",
    entityType: "venue",
    entityId: row.id,
    entityLabel: data!.venue_name,
    summary: `Added venue "${data!.venue_name}"`,
  });

  revalidatePath("/venues");
  revalidatePath("/activity");
  redirect(`/venues/${row.id}?flash=created`);
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
  const { data: before } = await supabase
    .from("venues")
    .select(Object.keys(data!).join(", "))
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("venues").update(data!).eq("id", id);
  if (error) return { error: error.message };

  const { keys, summary } = diffPayload(
    before as Record<string, unknown> | null,
    data! as Record<string, unknown>,
    VENUE_FIELD_LABELS,
  );
  if (keys.length) {
    await logActivity(supabase, {
      action: "updated",
      entityType: "venue",
      entityId: id,
      entityLabel: data!.venue_name,
      summary,
      details: { fields: keys },
    });
  }

  revalidatePath("/venues");
  revalidatePath(`/venues/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/activity");
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/venues/${id}?flash=updated`);
}

export async function deleteVenue(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: doomed } = await supabase
    .from("venues")
    .select("venue_name")
    .eq("id", id)
    .maybeSingle();
  // shows.venue_id is ON DELETE SET NULL, so shows are preserved.
  await supabase.from("venues").delete().eq("id", id);
  await logActivity(supabase, {
    action: "deleted",
    entityType: "venue",
    entityId: id,
    entityLabel: doomed?.venue_name ?? null,
    summary: doomed?.venue_name ? `Deleted venue "${doomed.venue_name}"` : "Deleted a venue",
  });
  revalidatePath("/venues");
  revalidatePath("/activity");
  redirect("/venues?flash=deleted");
}

/** Set a show's venue to this one ("Shows held here"). */
export async function addShowToVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const show_id = String(fd.get("show_id") ?? "");
  if (!venue_id || !show_id) return;
  const supabase = await createClient();
  await supabase.from("shows").update({ venue_id }).eq("id", show_id);
  revalidatePath(`/venues/${venue_id}`);
  revalidatePath(`/shows/${show_id}`);
}

/** Clear a show's venue link (keeps the show). */
export async function removeShowFromVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const show_id = String(fd.get("show_id") ?? "");
  if (!show_id) return;
  const supabase = await createClient();
  await supabase.from("shows").update({ venue_id: null }).eq("id", show_id);
  if (venue_id) revalidatePath(`/venues/${venue_id}`);
  revalidatePath(`/shows/${show_id}`);
}

/** Link a carrier to this venue (carrier_venues many-to-many). */
export async function addCarrierToVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const carrier_id = String(fd.get("carrier_id") ?? "");
  if (!venue_id || !carrier_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_venues")
    .upsert({ carrier_id, venue_id }, { onConflict: "carrier_id,venue_id" });
  revalidatePath(`/venues/${venue_id}`);
}

export async function removeCarrierFromVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const carrier_id = String(fd.get("carrier_id") ?? "");
  if (!venue_id || !carrier_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_venues")
    .delete()
    .eq("carrier_id", carrier_id)
    .eq("venue_id", venue_id);
  revalidatePath(`/venues/${venue_id}`);
}

/** Route an existing shipment through this venue (sets shipments.venue_id). */
export async function attachShipmentToVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const shipment_id = String(fd.get("shipment_id") ?? "");
  if (!venue_id || !shipment_id) return;
  const supabase = await createClient();
  await supabase.from("shipments").update({ venue_id }).eq("id", shipment_id);
  revalidatePath(`/venues/${venue_id}`);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipment_id}`);
}

/** Assign (or change) the show for one load, right from the venue page. */
export async function assignShowToShipment(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const shipment_id = String(fd.get("shipment_id") ?? "");
  const show_id = String(fd.get("show_id") ?? "");
  if (!shipment_id || !show_id) return;
  const supabase = await createClient();
  // Operator-assigned — mark sync-owned so the TMS sync won't override it.
  await supabase
    .from("shipments")
    .update({ show_id, show_auto_linked: false })
    .eq("id", shipment_id);
  if (venue_id) revalidatePath(`/venues/${venue_id}`);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipment_id}`);
}

/** Unlink a shipment from this venue (keeps the shipment). */
export async function detachShipmentFromVenue(fd: FormData) {
  const venue_id = String(fd.get("venue_id") ?? "");
  const shipment_id = String(fd.get("shipment_id") ?? "");
  if (!shipment_id) return;
  const supabase = await createClient();
  await supabase.from("shipments").update({ venue_id: null }).eq("id", shipment_id);
  if (venue_id) revalidatePath(`/venues/${venue_id}`);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipment_id}`);
}
