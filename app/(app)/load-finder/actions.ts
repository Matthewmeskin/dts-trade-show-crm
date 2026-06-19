"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncLoadNumber } from "@/lib/tms-sync";
import type { TablesUpdate } from "@/lib/database.types";

const nowIso = () => new Date().toISOString();

/** Dismiss a candidate — it drops off the Load Finder. */
export async function dismissCandidate(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("tms_load_candidates")
    .update({ review_status: "dismissed", updated_at: nowIso() })
    .eq("id", id);
  revalidatePath("/load-finder");
}

/** Turn a candidate into a tracked shipment and pull its live freight detail. */
export async function importCandidate(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const load_number = String(fd.get("load_number") ?? "").trim();
  if (!id || !load_number) return;

  const supabase = await createClient();

  // The candidate carries the GetLoads customer name, reference numbers, and
  // financials captured at scan time — the live tracking feed omits all of
  // these, so import is the only place we can seed them onto the shipment.
  const { data: cand } = await supabase
    .from("tms_load_candidates")
    .select("customer_name, po_ref, shipper_number, billed_amount, cost_amount")
    .eq("id", id)
    .maybeSingle();

  let exhibitor_id: string | null = null;
  const customerName = cand?.customer_name?.trim();
  if (customerName) {
    const { data: found } = await supabase
      .from("exhibitors")
      .select("id")
      .ilike("company_name", customerName)
      .limit(1)
      .maybeSingle();
    exhibitor_id =
      found?.id ??
      (
        await supabase
          .from("exhibitors")
          .insert({ company_name: customerName })
          .select("id")
          .single()
      ).data?.id ??
      null;
  }

  // Reference numbers + financials from the candidate (operator-owned: seed on
  // import, but never clobber a value already on the shipment).
  const po_ref = cand?.po_ref?.trim() || null;
  const shipper_number = cand?.shipper_number?.trim() || null;
  const billed_amount = cand?.billed_amount ?? null;
  const cost_amount = cand?.cost_amount ?? null;

  // Reuse an existing shipment for this load number, else create one.
  const { data: existing } = await supabase
    .from("shipments")
    .select("id, exhibitor_id, po_ref, shipper_number, billed_amount, cost_amount")
    .eq("tms_reference_id", load_number)
    .maybeSingle();

  let shipmentId = existing?.id ?? null;
  if (!shipmentId) {
    const { data: row } = await supabase
      .from("shipments")
      .insert({
        tms_reference_id: load_number,
        status: "booked",
        tms_sync_status: "manual",
        ...(exhibitor_id ? { exhibitor_id } : {}),
        ...(po_ref ? { po_ref } : {}),
        ...(shipper_number ? { shipper_number } : {}),
        ...(billed_amount != null ? { billed_amount } : {}),
        ...(cost_amount != null ? { cost_amount } : {}),
      })
      .select("id")
      .single();
    shipmentId = row?.id ?? null;
  } else if (existing) {
    // Fill only the operator-owned fields the shipment doesn't already have.
    const patch: TablesUpdate<"shipments"> = {};
    if (exhibitor_id && !existing.exhibitor_id) patch.exhibitor_id = exhibitor_id;
    if (po_ref && !existing.po_ref) patch.po_ref = po_ref;
    if (shipper_number && !existing.shipper_number) patch.shipper_number = shipper_number;
    if (billed_amount != null && existing.billed_amount == null) patch.billed_amount = billed_amount;
    if (cost_amount != null && existing.cost_amount == null) patch.cost_amount = cost_amount;
    if (Object.keys(patch).length) await supabase.from("shipments").update(patch).eq("id", shipmentId);
  }

  await supabase
    .from("tms_load_candidates")
    .update({ review_status: "imported", updated_at: nowIso() })
    .eq("id", id);

  // Pull live tracking now so freight detail is populated immediately.
  await syncLoadNumber(load_number);

  revalidatePath("/load-finder");
  revalidatePath("/shipments");
  if (shipmentId) redirect(`/shipments/${shipmentId}?flash=created`);
  redirect("/load-finder");
}

/** Kick off an on-demand scan by triggering the n8n scanner webhook. */
export async function triggerScan() {
  const url = process.env.N8N_SCAN_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, { method: "POST", cache: "no-store" });
    } catch {
      // n8n runs asynchronously; failures surface on its side.
    }
  }
  redirect(`/load-finder?flash=${url ? "scan" : "scan_unconfigured"}`);
}
