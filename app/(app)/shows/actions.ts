"use server";

import { revalidatePath } from "next/cache";
import { COMPLETABLE_STEPS, MILESTONE_META, type CompletableStep } from "@/lib/sales";
import { todayYMD } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import {
  composeFreightAddress,
  FREIGHT_ADDRESS_KEYS,
  type FreightAddressParts,
} from "@/lib/freight";

export type ShowFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

/**
 * Replace a show's assigned team. The checkbox form posts every selected user;
 * we clear the show's assignments and re-insert the current set. These users'
 * contact info is surfaced to exhibitors who upload an MHA for this show.
 */
export async function setShowAssignees(fd: FormData) {
  const showId = String(fd.get("show_id") ?? "");
  if (!showId) return;
  const userIds = [...new Set(fd.getAll("user_ids").map(String).filter(Boolean))];

  const supabase = await createClient();
  await supabase.from("show_assignees").delete().eq("show_id", showId);
  if (userIds.length) {
    await supabase
      .from("show_assignees")
      .insert(userIds.map((user_id) => ({ show_id: showId, user_id })));
  }
  revalidatePath(`/shows/${showId}`);
}

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
  const freight = (prefix: "advance_warehouse" | "direct_to_show" | "marshalling_yard") => {
    const parts: FreightAddressParts = {};
    for (const k of FREIGHT_ADDRESS_KEYS) parts[k] = str(fd, `${prefix}_${k}`);
    const address =
      composeFreightAddress(parts).oneLine ?? str(fd, `${prefix}_address_legacy`);
    return { parts, address };
  };
  const aw = freight("advance_warehouse");
  const dts = freight("direct_to_show");
  const my = freight("marshalling_yard");

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
      marshalling_yard_name: my.parts.name ?? null,
      marshalling_yard_care_of: my.parts.care_of ?? null,
      marshalling_yard_street1: my.parts.street1 ?? null,
      marshalling_yard_street2: my.parts.street2 ?? null,
      marshalling_yard_city: my.parts.city ?? null,
      marshalling_yard_state: my.parts.state ?? null,
      marshalling_yard_zip: my.parts.zip ?? null,
      marshalling_yard_country: my.parts.country ?? null,
      marshalling_yard_address: my.address,
      marshalling_yard_open: str(fd, "marshalling_yard_open"),
      marshalling_yard_cutoff: str(fd, "marshalling_yard_cutoff"),
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
      // Sales / lead-gen pipeline
      exhibitor_count: int(fd, "exhibitor_count"),
      sales_people: str(fd, "sales_people"),
      lead_gen_owner: str(fd, "lead_gen_owner"),
      lead_gen_start_date: str(fd, "lead_gen_start_date"),
      lead_gen_completion_date: str(fd, "lead_gen_completion_date"),
      move_in_schedule_url: str(fd, "move_in_schedule_url"),
      emailed_two_weeks: fd.get("emailed_two_weeks") === "on",
      instantly_created: fd.get("instantly_created") === "on",
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
  revalidatePath("/shows/sales");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/calendar");
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/shows/${id}?flash=updated`);
}

/** Inline-save just the sales/lead-gen fields from the sales calendar grid. */
/**
 * A date pair from the sales grid, saved only when it is coherent: both ends
 * present means the end is not before the start. A reversed pair is left as
 * it was rather than half-saved; the end picker's min stops that in practice.
 */
function datePair(fd: FormData, startKey: string, endKey: string): Record<string, string | null> {
  if (!fd.has(startKey) && !fd.has(endKey)) return {};
  const start = str(fd, startKey);
  const end = str(fd, endKey);
  if (start && end && end < start) return {};
  return { [startKey]: start, [endKey]: end };
}

export async function updateShowSales(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("shows")
    .update({
      ...datePair(fd, "show_start_date", "show_end_date"),
      ...datePair(fd, "advance_warehouse_open", "advance_warehouse_cutoff"),
      ...datePair(fd, "direct_to_show_start", "direct_to_show_end"),
      exhibitor_count: int(fd, "exhibitor_count"),
      industry_vertical: str(fd, "industry_vertical"),
      show_management_company: str(fd, "show_management_company"),
      sales_people: str(fd, "sales_people"),
      lead_gen_owner: str(fd, "lead_gen_owner"),
      lead_gen_start_date: str(fd, "lead_gen_start_date"),
      lead_gen_completion_date: str(fd, "lead_gen_completion_date"),
      emailed_two_weeks: fd.get("emailed_two_weeks") === "on",
      week_before_sent: fd.get("week_before_sent") === "on",
      start_call_done: fd.get("start_call_done") === "on",
      instantly_created: fd.get("instantly_created") === "on",
    })
    .eq("id", id);
  revalidatePath("/shows/sales");
  revalidatePath(`/shows/${id}`);
  revalidatePath("/calendar");
}

/**
 * One click on the calendar's "Done": completes the show's next sales step
 * with the same fields the row edits by hand — the LG done date for lead gen,
 * the three boxes for calling and the two emails — so there is no second way
 * of saying "done".
 */
export async function completeSalesStep(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const step = String(fd.get("step") ?? "");
  if (!id || !(COMPLETABLE_STEPS as readonly string[]).includes(step)) return;
  const supabase = await createClient();
  let patch: TablesUpdate<"shows">;
  if (step === "lead_gen_done") {
    // Finishing lead gen stamps today, and fills the start too if nobody did.
    const { data: cur } = await supabase.from("shows").select("lead_gen_start_date").eq("id", id).single();
    patch = { lead_gen_completion_date: todayYMD(), ...(cur?.lead_gen_start_date ? {} : { lead_gen_start_date: todayYMD() }) };
  } else if (step === "start_call") patch = { start_call_done: true };
  else if (step === "email_team") patch = { emailed_two_weeks: true };
  else patch = { week_before_sent: true };
  const { error } = await supabase.from("shows").update(patch).eq("id", id);
  if (!error) {
    await logActivity(supabase, {
      action: "updated",
      entityType: "show",
      entityId: id,
      summary: `Sales calendar: marked "${MILESTONE_META[step as CompletableStep].label}" done`,
    });
  }
  revalidatePath("/shows/sales");
  revalidatePath(`/shows/${id}`);
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

/** Link a carrier to this show (from the show's Carriers tab). */
export async function addCarrierToShow(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const carrier_id = String(fd.get("carrier_id") ?? "");
  if (!show_id || !carrier_id) return;
  const supabase = await createClient();
  await supabase
    .from("carrier_shows")
    .upsert({ show_id, carrier_id }, { onConflict: "carrier_id,show_id" });
  revalidatePath(`/shows/${show_id}`);
  revalidatePath(`/carriers/${carrier_id}`);
}

export async function removeCarrierFromShow(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const carrier_id = String(fd.get("carrier_id") ?? "");
  if (!show_id || !carrier_id) return;
  const supabase = await createClient();
  await supabase.from("carrier_shows").delete().eq("show_id", show_id).eq("carrier_id", carrier_id);
  revalidatePath(`/shows/${show_id}`);
  revalidatePath(`/carriers/${carrier_id}`);
}

/** Star a carrier as preferred for this show (one preferred per show). */
export async function togglePreferredCarrier(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const carrier_id = String(fd.get("carrier_id") ?? "");
  if (!show_id || !carrier_id) return;
  const makePreferred = String(fd.get("preferred") ?? "") === "1";
  const supabase = await createClient();
  // Ensure the link exists, then set the flag (clearing others when starring).
  await supabase.from("carrier_shows").upsert({ show_id, carrier_id }, { onConflict: "carrier_id,show_id" });
  if (makePreferred) {
    await supabase.from("carrier_shows").update({ preferred: false }).eq("show_id", show_id);
    await supabase.from("carrier_shows").update({ preferred: true }).eq("show_id", show_id).eq("carrier_id", carrier_id);
  } else {
    await supabase.from("carrier_shows").update({ preferred: false }).eq("show_id", show_id).eq("carrier_id", carrier_id);
  }
  revalidatePath(`/shows/${show_id}`);
  revalidatePath(`/carriers/${carrier_id}`);
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

export type QuickShowState = { error: string | null; ok?: string };

/**
 * "+ Add show" on the sales calendar: the few fields the calendar needs to
 * start working a show — name and dates, plus industry and lead-gen owner if
 * known. Everything else is filled in on the show's own page as usual.
 */
export async function quickAddShow(_prev: QuickShowState, fd: FormData): Promise<QuickShowState> {
  const show_name = str(fd, "show_name");
  const show_start_date = str(fd, "show_start_date");
  const show_end_date = str(fd, "show_end_date") ?? show_start_date;
  if (!show_name) return { error: "Give the show a name." };
  if (!show_start_date) return { error: "Add the show's start date — the calendar counts back from it." };
  if (show_end_date && show_end_date < show_start_date) return { error: "The end date is before the start date." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("shows")
    .insert({
      show_name,
      show_start_date,
      show_end_date,
      edition_year: Number(show_start_date.slice(0, 4)),
      industry_vertical: str(fd, "industry_vertical"),
      lead_gen_owner: str(fd, "lead_gen_owner"),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logActivity(supabase, {
    action: "created",
    entityType: "show",
    entityId: row.id,
    entityLabel: show_name,
    summary: "Added from the sales calendar",
  });
  revalidatePath("/shows");
  revalidatePath("/shows/sales");
  revalidatePath("/calendar");
  return { error: null, ok: `${show_name} added.` };
}
