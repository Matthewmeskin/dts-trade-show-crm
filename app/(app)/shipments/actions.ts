"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants, type TablesInsert } from "@/lib/database.types";

export type ShipmentFormState = {
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
  const n = Number.parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
function enumOrNull<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function parseShipment(fd: FormData): TablesInsert<"shipments"> {
  const status =
    enumOrNull(str(fd, "status"), Constants.public.Enums.shipment_status) ?? "quoted";
  const tms_sync_status =
    enumOrNull(str(fd, "tms_sync_status"), Constants.public.Enums.tms_sync_status) ??
    "manual";

  return {
    show_id: str(fd, "show_id"),
    exhibitor_id: str(fd, "exhibitor_id"),
    carrier_id: str(fd, "carrier_id"),
    origin_street: str(fd, "origin_street"),
    origin_city: str(fd, "origin_city"),
    origin_state: str(fd, "origin_state"),
    origin_zip: str(fd, "origin_zip"),
    destination_type: enumOrNull(
      str(fd, "destination_type"),
      Constants.public.Enums.shipment_destination,
    ),
    pieces: int(fd, "pieces"),
    weight: num(fd, "weight"),
    mode: enumOrNull(str(fd, "mode"), Constants.public.Enums.shipment_mode),
    special_requirements: str(fd, "special_requirements"),
    pro_number: str(fd, "pro_number"),
    pickup_date: str(fd, "pickup_date"),
    estimated_delivery_date: str(fd, "estimated_delivery_date"),
    actual_delivery_date: str(fd, "actual_delivery_date"),
    status,
    accessorials_flagged: fd.get("accessorials_flagged") === "on",
    notes: str(fd, "notes"),
    tms_reference_id: str(fd, "tms_reference_id"),
    tms_sync_status,
  };
}

export async function createShipment(
  _prev: ShipmentFormState,
  fd: FormData,
): Promise<ShipmentFormState> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("shipments")
    .insert(parseShipment(fd))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "That TMS reference ID is already in use.", fieldErrors: { tms_reference_id: "Must be unique." } };
    }
    return { error: error.message };
  }

  revalidatePath("/shipments");
  const showId = String(fd.get("show_id") ?? "");
  if (showId) revalidatePath(`/shows/${showId}`);
  redirect(`/shipments/${row.id}?flash=created`);
}

export async function updateShipment(
  _prev: ShipmentFormState,
  fd: FormData,
): Promise<ShipmentFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing shipment id." };

  const supabase = await createClient();
  const { error } = await supabase.from("shipments").update(parseShipment(fd)).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return { error: "That TMS reference ID is already in use.", fieldErrors: { tms_reference_id: "Must be unique." } };
    }
    return { error: error.message };
  }

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  redirect(`/shipments/${id}?flash=updated`);
}

export async function updateShipmentStatus(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const status = enumOrNull(
    String(fd.get("status") ?? ""),
    Constants.public.Enums.shipment_status,
  );
  if (!id || !status) return;

  const supabase = await createClient();
  await supabase.from("shipments").update({ status }).eq("id", id);
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
}

export async function deleteShipment(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("shipments").delete().eq("id", id);
  revalidatePath("/shipments");
  redirect("/shipments?flash=deleted");
}
