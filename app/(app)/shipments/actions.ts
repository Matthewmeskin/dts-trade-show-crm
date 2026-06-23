"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants, type TablesInsert, type TablesUpdate } from "@/lib/database.types";
import { syncLoadNumber } from "@/lib/tms-sync";

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
    destination_type: enumOrNull(
      str(fd, "destination_type"),
      Constants.public.Enums.shipment_destination,
    ),
    direction: enumOrNull(str(fd, "direction"), Constants.public.Enums.shipment_direction),
    target_delivery_date: str(fd, "target_delivery_date"),
    show_date: str(fd, "show_date"),
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
  const { error } = await supabase.from("shipments").update(payload).eq("id", id);
  if (error) {
    if (error.code === "23505") return DUP_LOAD;
    return { error: error.message };
  }

  // Refresh live tracking when a load number is present.
  if (payload.tms_reference_id) await syncLoadNumber(payload.tms_reference_id);

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/calendar");
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
  const [{ data: shipment }, { data: showsData }, { data: exhibitorsData }, { data: venuesData }] =
    await Promise.all([
      supabase
        .from("shipments")
        .select(
          "*, exhibitor:exhibitors(id, company_name, industry, primary_contact_name, primary_contact_title, primary_contact_email, primary_contact_phone, secondary_contacts, freight_profile_notes, general_notes), show:shows(id, show_name, edition_year, industry_vertical, show_management_company, show_start_date, show_end_date, move_in_start, move_in_end, move_out_start, move_out_end, advance_warehouse_open, advance_warehouse_cutoff, advance_warehouse_address, direct_to_show_address, direct_to_show_start, direct_to_show_end, website_url, exhibitor_manual_url, exhibitor_list_url, general_notes), carrier:carriers(id, carrier_name, trade_show_notes), venue:venues(id, venue_name, address, city, state, dock_notes, union_rules, delivery_restrictions, parking_and_staging_notes, general_notes)",
        )
        .eq("id", id)
        .single(),
      supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
      supabase.from("exhibitors").select("id, company_name").order("company_name"),
      supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
    ]);
  if (!shipment) return null;
  return {
    shipment,
    shows: (showsData ?? []).map((x) => ({
      id: x.id,
      label: `${x.show_name}${x.edition_year ? ` ${x.edition_year}` : ""}`,
    })),
    exhibitors: (exhibitorsData ?? []).map((x) => ({ id: x.id, label: x.company_name })),
    venues: (venuesData ?? []).map((x) => ({
      id: x.id,
      label: `${x.venue_name}${x.city ? ` (${x.city}${x.state ? `, ${x.state}` : ""})` : ""}`,
    })),
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
