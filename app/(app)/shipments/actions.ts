"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants, type TablesInsert, type TablesUpdate } from "@/lib/database.types";
import { DOCUMENTS_BUCKET } from "@/lib/documents";
import { syncLoadNumber } from "@/lib/tms-sync";
import { logActivity, shipmentLabel, SHIPMENT_FIELD_LABELS } from "@/lib/activity";
import { FORCED_REASON_META } from "@/lib/forced";

export type ShipmentFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
/**
 * Parse a money/number field, tolerating "$" and thousands separators.
 * Negatives are rejected (billed/cost are non-negative) — the form's
 * `min="0"` is client-only, so we guard server-side too.
 */
const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  if (v === "") return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
function enumOrNull<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Only the operator-owned fields. Freight details (carrier, status, mode,
 * weight, dates, PRO, origin) belong to the TMS sync and are never written
 * from this form, so an operator edit can't clobber synced data. Financials
 * (billed/cost) and the PO / shipper reference numbers are operator-owned too;
 * `margin` is a generated column, so it's never written here.
 */
function operatorFields(fd: FormData) {
  return {
    tms_reference_id: str(fd, "tms_reference_id"),
    show_id: str(fd, "show_id"),
    exhibitor_id: str(fd, "exhibitor_id"),
    venue_id: str(fd, "venue_id"),
    // An operator saved the form — these links are now manually owned.
    venue_auto_linked: false,
    show_auto_linked: false,
    destination_type: enumOrNull(
      str(fd, "destination_type"),
      Constants.public.Enums.shipment_destination,
    ),
    direction: enumOrNull(str(fd, "direction"), Constants.public.Enums.shipment_direction),
    target_delivery_date: str(fd, "target_delivery_date"),
    show_date: str(fd, "show_date"),
    check_in_number: str(fd, "check_in_number"),
    po_ref: str(fd, "po_ref"),
    shipper_number: str(fd, "shipper_number"),
    billed_amount: num(fd, "billed_amount"),
    cost_amount: num(fd, "cost_amount"),
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

  await logActivity(supabase, {
    action: "created",
    entityType: "shipment",
    entityId: row.id,
    entityLabel: await shipmentLabel(supabase, row.id),
    summary: payload.tms_reference_id ? `Logged load ${payload.tms_reference_id}` : "Logged a shipment",
  });

  // Pull live tracking right away so freight details appear immediately.
  if (payload.tms_reference_id) await syncLoadNumber(payload.tms_reference_id);

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

  // Snapshot the before-state so we can log exactly which fields changed.
  const trackedKeys = Object.keys(SHIPMENT_FIELD_LABELS);
  const { data: before } = await supabase
    .from("shipments")
    .select(trackedKeys.join(", "))
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("shipments").update(payload).eq("id", id);
  if (error) {
    if (error.code === "23505") return DUP_LOAD;
    return { error: error.message };
  }

  const beforeRow = (before ?? {}) as Record<string, unknown>;
  const changed = trackedKeys.filter(
    (k) =>
      k in payload &&
      String(beforeRow[k] ?? "") !== String((payload as Record<string, unknown>)[k] ?? ""),
  );
  if (changed.length) {
    await logActivity(supabase, {
      action: "updated",
      entityType: "shipment",
      entityId: id,
      entityLabel: await shipmentLabel(supabase, id),
      summary: `Changed ${changed.map((k) => SHIPMENT_FIELD_LABELS[k]).join(", ")}`,
      details: { fields: changed },
    });
  }

  // Refresh live tracking when a load number is present.
  if (payload.tms_reference_id) await syncLoadNumber(payload.tms_reference_id);

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/activity");
  // Return where the editor came from (e.g. the calendar side panel) when given.
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/shipments/${id}?flash=updated`);
}

/**
 * Full data for the calendar / list shipment side panel: the shipment with its
 * linked records, plus show & exhibitor options for inline editing. Loaded on
 * demand when a panel opens so the calendar query itself stays light.
 */
export async function getShipmentDrawerData(id: string) {
  if (!id) return null;
  const supabase = await createClient();
  const [
    { data: shipment },
    { data: showsData },
    { data: exhibitorsData },
    { data: venuesData },
    { data: contactsData },
  ] = await Promise.all([
    // Full linked rows (*) so each record's edit form can populate fully.
    supabase
      .from("shipments")
      .select(
        "*, exhibitor:exhibitors(*), show:shows(*), carrier:carriers(*), venue:venues(*), forced_by_profile:profiles!shipments_forced_by_fkey(full_name, email)",
      )
      .eq("id", id)
      .single(),
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
    supabase.from("exhibitors").select("id, company_name").order("company_name"),
    supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
    supabase.from("contacts").select("id, first_name, last_name, company").order("last_name"),
  ]);
  if (!shipment) return null;
  return {
    shipment,
    shows: (showsData ?? []).map((x) => ({
      id: x.id,
      label: `${x.show_name}${x.edition_year ? ` ${x.edition_year}` : ""}`,
    })),
    exhibitors: (exhibitorsData ?? []).map((x) => ({ id: x.id, label: x.company_name })),
    // {id,label} for the shipment form's venue select.
    venues: (venuesData ?? []).map((x) => ({
      id: x.id,
      label: `${x.venue_name}${x.city ? ` (${x.city}${x.state ? `, ${x.state}` : ""})` : ""}`,
    })),
    // Full venue rows + contacts for the show edit form.
    venueRecords: venuesData ?? [],
    contacts: contactsData ?? [],
  };
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
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "shipment",
    entityId: id,
    entityLabel: await shipmentLabel(supabase, id),
    summary: `Set status to ${status.replace(/_/g, " ")}`,
  });
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/activity");
}

/** Save the move-out check-in number from the inline cell editor. */
export async function setCheckInNumber(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const value = String(fd.get("check_in_number") ?? "").trim();
  const supabase = await createClient();
  await supabase
    .from("shipments")
    .update({ check_in_number: value || null })
    .eq("id", id);
  await logActivity(supabase, {
    action: "updated",
    entityType: "shipment",
    entityId: id,
    entityLabel: await shipmentLabel(supabase, id),
    summary: value ? `Set check-in number to ${value}` : "Cleared the check-in number",
    details: { fields: ["check_in_number"] },
  });
  const showId = String(fd.get("show_id") ?? "");
  if (showId) revalidatePath(`/shows/${showId}`);
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/activity");
}

/** Documents attached directly to a shipment (newest first). */
export async function getShipmentDocuments(shipmentId: string) {
  if (!shipmentId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, document_name, file_url, uploaded_at")
    .eq("shipment_id", shipmentId)
    .order("uploaded_at", { ascending: false });
  return data ?? [];
}

/**
 * Insert a document row for a shipment after the file is already in Storage
 * (the upload happens client-side, direct to the bucket).
 */
export async function createShipmentDocument(
  fd: FormData,
): Promise<{ error: string | null }> {
  const shipment_id = String(fd.get("shipment_id") ?? "").trim();
  const document_name = String(fd.get("document_name") ?? "").trim();
  const file_url = String(fd.get("file_url") ?? "").trim();
  const show_id = String(fd.get("show_id") ?? "").trim() || null;
  if (!shipment_id) return { error: "Missing shipment." };
  if (!document_name) return { error: "A document name is required." };
  if (!file_url) return { error: "Upload a file first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("documents").insert({
    shipment_id,
    show_id,
    document_name,
    file_url,
    uploaded_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  if (show_id) revalidatePath(`/shows/${show_id}`);
  revalidatePath(`/shipments/${shipment_id}`);
  return { error: null };
}

/** Remove a shipment document (storage object + row). */
export async function deleteShipmentDocument(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const path = String(fd.get("path") ?? "");
  if (!id) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  await supabase.from("documents").delete().eq("id", id);
  const show_id = String(fd.get("show_id") ?? "");
  if (show_id) revalidatePath(`/shows/${show_id}`);
}

export async function deleteShipment(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const label = await shipmentLabel(supabase, id);
  await supabase.from("shipments").delete().eq("id", id);
  await logActivity(supabase, {
    action: "deleted",
    entityType: "shipment",
    entityId: id,
    entityLabel: label,
    summary: "Deleted the shipment",
  });
  revalidatePath("/shipments");
  revalidatePath("/activity");
  redirect("/shipments?flash=deleted");
}

export type ForcedState = { error: string | null };

/**
 * Flag a move-out as forced (our carrier didn't show / paperwork error, so the
 * general contractor force-shipped it). Records who, when, and why. Marking a
 * load forced also restarts the dashboard's successful-move-out counter.
 */
export async function setShipmentForced(_prev: ForcedState, fd: FormData): Promise<ForcedState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing shipment." };

  const reason = enumOrNull(
    String(fd.get("forced_reason") ?? ""),
    Constants.public.Enums.forced_reason,
  );
  if (!reason) return { error: "Choose a reason." };

  const other = String(fd.get("forced_reason_other") ?? "").trim();
  if (reason === "other" && !other) return { error: "Tell us what happened." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("shipments")
    .update({
      forced: true,
      forced_reason: reason,
      forced_reason_other: reason === "other" ? other : null,
      forced_at: new Date().toISOString(),
      forced_by: user?.id ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const reasonText = reason === "other" ? other : FORCED_REASON_META[reason].label;
  await logActivity(supabase, {
    action: "forced",
    entityType: "shipment",
    entityId: id,
    entityLabel: await shipmentLabel(supabase, id),
    summary: `Marked forced — ${reasonText}`,
    details: { reason, reason_other: reason === "other" ? other : null },
  });

  revalidatePath("/");
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/activity");
  return { error: null };
}

/** Clear forced status from a move-out (e.g. flagged in error). */
export async function clearShipmentForced(_prev: ForcedState, fd: FormData): Promise<ForcedState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing shipment." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .update({
      forced: false,
      forced_reason: null,
      forced_reason_other: null,
      forced_at: null,
      forced_by: null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logActivity(supabase, {
    action: "unforced",
    entityType: "shipment",
    entityId: id,
    entityLabel: await shipmentLabel(supabase, id),
    summary: "Removed forced status",
  });

  revalidatePath("/");
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/activity");
  return { error: null };
}
