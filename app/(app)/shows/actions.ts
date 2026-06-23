"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";
import {
  composeFreightAddress,
  FREIGHT_ADDRESS_KEYS,
  type FreightAddressParts,
} from "@/lib/freight";

export type ShowFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number.parseFloat(v.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Build a validated shows payload from the form. */
function parseShow(fd: FormData): {
  data?: TablesInsert<"shows">;
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const show_name = str(fd, "show_name");
  if (!show_name) fieldErrors.show_name = "Show name is required.";

  const move_in_start = str(fd, "move_in_start");
  const move_out_end = str(fd, "move_out_end");
  if (move_in_start && move_out_end && move_in_start > move_out_end) {
    fieldErrors.move_out_end = "Move-out must be on or after move-in.";
  }

  const show_start = str(fd, "show_start_date");
  const show_end = str(fd, "show_end_date");
  if (show_start && show_end && show_start > show_end) {
    fieldErrors.show_end_date = "Show end must be on or after show start.";
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  // Read each freight address's structured parts, and compose them into the
  // legacy single-line *_address column (falling back to any existing value the
  // form carries in a hidden field so it isn't wiped when parts are empty).
  const freight = (prefix: "advance_warehouse" | "direct_to_show") => {
    const parts: FreightAddressParts = {};
    for (const k of FREIGHT_ADDRESS_KEYS) parts[k] = str(fd, `${prefix}_${k}`);
    const address =
      composeFreightAddress(parts).oneLine ?? str(fd, `${prefix}_address_legacy`);
    return { parts, address };
  };
  const aw = freight("advance_warehouse");
  const dts = freight("direct_to_show");

  return {
    data: {
      advance_warehouse_name: aw.parts.name ?? null,
      advance_warehouse_care_of: aw.parts.care_of ?? null,
      advance_warehouse_street1: aw.parts.street1 ?? null,
      advance_warehouse_street2: aw.parts.street2 ?? null,
      advance_warehouse_city: aw.parts.city ?? null,
      advance_warehouse_state: aw.parts.state ?? null,
      advance_warehouse_zip: aw.parts.zip ?? null,
      advance_warehouse_country: aw.parts.country ?? null,
      advance_warehouse_address: aw.address,
      direct_to_show_name: dts.parts.name ?? null,
      direct_to_show_care_of: dts.parts.care_of ?? null,
      direct_to_show_street1: dts.parts.street1 ?? null,
      direct_to_show_street2: dts.parts.street2 ?? null,
      direct_to_show_city: dts.parts.city ?? null,
      direct_to_show_state: dts.parts.state ?? null,
      direct_to_show_zip: dts.parts.zip ?? null,
      direct_to_show_country: dts.parts.country ?? null,
      direct_to_show_address: dts.address,
      show_name: show_name!,
      edition_year: int(fd, "edition_year"),
      industry_vertical: str(fd, "industry_vertical"),
      show_management_company: str(fd, "show_management_company"),
      venue_id: str(fd, "venue_id"),
      gsc_contact_id: str(fd, "gsc_contact_id"),
      website_url: str(fd, "website_url"),
      exhibitor_manual_url: str(fd, "exhibitor_manual_url"),
      exhibitor_list_url: str(fd, "exhibitor_list_url"),
      archived: fd.get("archived") === "on",
      show_start_date: str(fd, "show_start_date"),
      show_end_date: str(fd, "show_end_date"),
      move_in_start,
      move_in_end: str(fd, "move_in_end"),
      move_out_start: str(fd, "move_out_start"),
      move_out_end,
      advance_warehouse_open: str(fd, "advance_warehouse_open"),
      advance_warehouse_cutoff: str(fd, "advance_warehouse_cutoff"),
      direct_to_show_start: str(fd, "direct_to_show_start"),
      direct_to_show_end: str(fd, "direct_to_show_end"),
      estimated_revenue: num(fd, "estimated_revenue"),
      actual_revenue: num(fd, "actual_revenue"),
      competitor_notes: str(fd, "competitor_notes"),
      general_notes: str(fd, "general_notes"),
    },
  };
}

export async function createShow(
  _prev: ShowFormState,
  fd: FormData,
): Promise<ShowFormState> {
  const { data, fieldErrors } = parseShow(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("shows")
    .insert(data!)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/shows");
  redirect(`/shows/${row.id}?flash=created`);
}

export async function updateShow(
  _prev: ShowFormState,
  fd: FormData,
): Promise<ShowFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing show id." };

  const { data, fieldErrors } = parseShow(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("shows").update(data!).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/shows");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/calendar");
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/shows/${id}?flash=updated`);
}

export async function deleteShow(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("shows").delete().eq("id", id);
  revalidatePath("/shows");
  redirect("/shows?flash=deleted");
}

export async function addExhibitorToShow(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const exhibitor_id = String(fd.get("exhibitor_id") ?? "");
  if (!show_id || !exhibitor_id) return;
  const supabase = await createClient();
  // Ignore duplicates (unique constraint on show_id+exhibitor_id).
  await supabase
    .from("show_exhibitors")
    .upsert({ show_id, exhibitor_id }, { onConflict: "show_id,exhibitor_id" });
  revalidatePath(`/shows/${show_id}`);
}

export async function removeExhibitorFromShow(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const exhibitor_id = String(fd.get("exhibitor_id") ?? "");
  if (!show_id || !exhibitor_id) return;
  const supabase = await createClient();
  await supabase
    .from("show_exhibitors")
    .delete()
    .eq("show_id", show_id)
    .eq("exhibitor_id", exhibitor_id);
  revalidatePath(`/shows/${show_id}`);
}

/** Link an already-logged shipment to this show. */
export async function attachShipmentToShow(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const shipment_id = String(fd.get("shipment_id") ?? "");
  if (!show_id || !shipment_id) return;
  const supabase = await createClient();
  await supabase.from("shipments").update({ show_id }).eq("id", shipment_id);
  revalidatePath(`/shows/${show_id}`);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipment_id}`);
}

/** Unlink a shipment from this show (keeps the shipment). */
export async function detachShipmentFromShow(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const shipment_id = String(fd.get("shipment_id") ?? "");
  if (!shipment_id) return;
  const supabase = await createClient();
  await supabase.from("shipments").update({ show_id: null }).eq("id", shipment_id);
  if (show_id) revalidatePath(`/shows/${show_id}`);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipment_id}`);
}

export type DebriefState = { error: string | null; ok?: boolean };

export async function saveDebrief(
  _prev: DebriefState,
  fd: FormData,
): Promise<DebriefState> {
  const show_id = String(fd.get("show_id") ?? "");
  if (!show_id) return { error: "Missing show id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    show_id,
    what_went_well: str(fd, "what_went_well"),
    what_went_wrong: str(fd, "what_went_wrong"),
    carrier_performance_notes: str(fd, "carrier_performance_notes"),
    venue_issues: str(fd, "venue_issues"),
    recommendations_next_year: str(fd, "recommendations_next_year"),
    logged_by: user?.id ?? null,
  };

  const existingId = String(fd.get("debrief_id") ?? "");
  const result = existingId
    ? await supabase.from("show_debriefs").update(payload).eq("id", existingId)
    : await supabase.from("show_debriefs").insert(payload);

  if (result.error) return { error: result.error.message };

  revalidatePath(`/shows/${show_id}`);
  return { error: null, ok: true };
}
