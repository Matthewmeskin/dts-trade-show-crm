"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

export type CarrierFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function parseCarrier(fd: FormData): {
  data?: TablesInsert<"carriers">;
  fieldErrors?: Record<string, string>;
} {
  const carrier_name = str(fd, "carrier_name");
  if (!carrier_name) return { fieldErrors: { carrier_name: "Carrier name is required." } };
  return { data: { carrier_name, trade_show_notes: str(fd, "trade_show_notes") } };
}

export async function createCarrier(
  _prev: CarrierFormState,
  fd: FormData,
): Promise<CarrierFormState> {
  const { data, fieldErrors } = parseCarrier(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("carriers")
    .insert(data!)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/carriers");
  redirect(`/carriers/${row.id}?flash=created`);
}

export async function updateCarrier(
  _prev: CarrierFormState,
  fd: FormData,
): Promise<CarrierFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing carrier id." };

  const { data, fieldErrors } = parseCarrier(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("carriers").update(data!).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/carriers");
  revalidatePath(`/carriers/${id}`);
  revalidatePath("/calendar");
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/carriers/${id}?flash=updated`);
}

export async function deleteCarrier(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("carriers").delete().eq("id", id);
  revalidatePath("/carriers");
  redirect("/carriers?flash=deleted");
}

export async function addVenueToCarrier(fd: FormData) {
  const carrier_id = String(fd.get("carrier_id") ?? "");
  const venue_id = String(fd.get("venue_id") ?? "");
  if (!carrier_id || !venue_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_venues")
    .upsert({ carrier_id, venue_id }, { onConflict: "carrier_id,venue_id" });
  revalidatePath(`/carriers/${carrier_id}`);
}

export async function removeVenueFromCarrier(fd: FormData) {
  const carrier_id = String(fd.get("carrier_id") ?? "");
  const venue_id = String(fd.get("venue_id") ?? "");
  if (!carrier_id || !venue_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_venues")
    .delete()
    .eq("carrier_id", carrier_id)
    .eq("venue_id", venue_id);
  revalidatePath(`/carriers/${carrier_id}`);
}

export async function addShowToCarrier(fd: FormData) {
  const carrier_id = String(fd.get("carrier_id") ?? "");
  const show_id = String(fd.get("show_id") ?? "");
  if (!carrier_id || !show_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_shows")
    .upsert({ carrier_id, show_id }, { onConflict: "carrier_id,show_id" });
  revalidatePath(`/carriers/${carrier_id}`);
}

export async function removeShowFromCarrier(fd: FormData) {
  const carrier_id = String(fd.get("carrier_id") ?? "");
  const show_id = String(fd.get("show_id") ?? "");
  if (!carrier_id || !show_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_shows")
    .delete()
    .eq("carrier_id", carrier_id)
    .eq("show_id", show_id);
  revalidatePath(`/carriers/${carrier_id}`);
}
