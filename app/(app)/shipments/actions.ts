"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants, type TablesInsert, type TablesUpdate } from "@/lib/database.types";

export type ShipmentFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
function enumOrNull<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Only the operator-owned fields. Freight details (carrier, status, mode,
 * weight, dates, PRO, origin) belong to the TMS sync and are never written
 * from this form, so an operator edit can't clobber synced data.
 */
function operatorFields(fd: FormData) {
  return {
    tms_reference_id: str(fd, "tms_reference_id"),
    show_id: str(fd, "show_id"),
    exhibitor_id: str(fd, "exhibitor_id"),
    destination_type: enumOrNull(
      str(fd, "destination_type"),
      Constants.public.Enums.shipment_destination,
    ),
    special_requirements: str(fd, "special_requirements"),
    notes: str(fd, "notes"),
  };
}

const DUP_LOAD = {
  error: "That load number is already on another shipment.",
  fieldErrors: { tms_reference_id: "Must be unique." },
};

export async function createShipment(
  _prev: ShipmentFormState,
  fd: FormData,
): Promise<ShipmentFormState> {
  const supabase = await createClient();
  // A manually-created shipment isn't from the TMS, so mark it Manual.
  const payload: TablesInsert<"shipments"> = {
    ...operatorFields(fd),
    status: "quoted",
    tms_sync_status: "manual",
  };
  const { data: row, error } = await supabase
    .from("shipments")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return DUP_LOAD;
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
  // Only the operator-owned fields — never the TMS-synced freight data.
  const payload: TablesUpdate<"shipments"> = operatorFields(fd);
  const { error } = await supabase.from("shipments").update(payload).eq("id", id);
  if (error) {
    if (error.code === "23505") return DUP_LOAD;
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
