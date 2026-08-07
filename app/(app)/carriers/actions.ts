"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity, diffPayload, CARRIER_FIELD_LABELS } from "@/lib/activity";
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
  return {
    data: {
      carrier_name,
      trade_show_notes: str(fd, "trade_show_notes"),
      bill_to_company: str(fd, "bill_to_company"),
      bill_to_address1: str(fd, "bill_to_address1"),
      bill_to_address2: str(fd, "bill_to_address2"),
      bill_to_city: str(fd, "bill_to_city"),
      bill_to_state: str(fd, "bill_to_state"),
      bill_to_zip: str(fd, "bill_to_zip"),
      bill_to_phone: str(fd, "bill_to_phone"),
    },
  };
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

  await logActivity(supabase, {
    action: "created",
    entityType: "carrier",
    entityId: row.id,
    entityLabel: data!.carrier_name,
    summary: `Added carrier "${data!.carrier_name}"`,
  });

  revalidatePath("/carriers");
  revalidatePath("/activity");
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
  const { data: before } = await supabase
    .from("carriers")
    .select(Object.keys(data!).join(", "))
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("carriers").update(data!).eq("id", id);
  if (error) return { error: error.message };

  const { keys, summary } = diffPayload(
    before as Record<string, unknown> | null,
    data! as Record<string, unknown>,
    CARRIER_FIELD_LABELS,
  );
  if (keys.length) {
    await logActivity(supabase, {
      action: "updated",
      entityType: "carrier",
      entityId: id,
      entityLabel: data!.carrier_name,
      summary,
      details: { fields: keys },
    });
  }

  revalidatePath("/carriers");
  revalidatePath(`/carriers/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/activity");
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/carriers/${id}?flash=updated`);
}

export async function deleteCarrier(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: doomed } = await supabase
    .from("carriers")
    .select("carrier_name")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("carriers").delete().eq("id", id);
  await logActivity(supabase, {
    action: "deleted",
    entityType: "carrier",
    entityId: id,
    entityLabel: doomed?.carrier_name ?? null,
    summary: doomed?.carrier_name ? `Deleted carrier "${doomed.carrier_name}"` : "Deleted a carrier",
  });
  revalidatePath("/carriers");
  revalidatePath("/activity");
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
