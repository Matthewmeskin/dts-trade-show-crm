"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { todayYMD } from "@/lib/format";
import { parseQuarter, quarterName } from "@/lib/rebates";
import { loadRebateDraft } from "./rebate-data";

/**
 * Partner credit on loads, and the quarterly rebate statement.
 *
 * Crediting is any member's call (the office email names the partner code, or
 * the exhibitor is the partner's client). Issuing a statement and marking it
 * paid commit DTS money, so the database only lets admins do those.
 */

export type RebateState = { error: string | null; ok?: boolean; message?: string };

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

const SOURCES = new Set(["referral_code", "client", "manual"]);

function touch(partnerIds: (string | null | undefined)[], shipmentIds: string[] = []) {
  for (const p of new Set(partnerIds.filter(Boolean))) {
    revalidatePath(`/partners/${p}`);
    revalidatePath(`/partners/${p}/rebates`);
  }
  for (const s of shipmentIds) revalidatePath(`/shipments/${s}`);
}

/** Credit the ticked suggestions on the partner page to this partner. */
export async function creditShipments(_prev: RebateState, fd: FormData): Promise<RebateState> {
  const partner_id = str(fd, "partner_id");
  const ids = fd.getAll("shipment_id").map(String).filter(Boolean);
  if (!partner_id) return { error: "Missing partner." };
  if (!ids.length) return { error: "Tick at least one load." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only loads nobody has credited yet: this never takes a load from another
  // partner. Shipping Center loads never earn partner credit.
  const { data, error } = await supabase
    .from("shipments")
    .update({
      partner_id,
      partner_credit_source: "client",
      partner_credited_at: new Date().toISOString(),
      partner_credited_by: user?.id ?? null,
    })
    .in("id", ids)
    .is("partner_id", null)
    .eq("source", "tms")
    .select("id");
  if (error) return { error: error.message };
  const done = data?.length ?? 0;
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: partner_id,
    summary: `Credited ${done} load${done === 1 ? "" : "s"} to the partner`,
    details: { shipment_ids: data?.map((d) => d.id) },
  });
  touch([partner_id], ids);
  const skipped = ids.length - done;
  return {
    error: null,
    ok: true,
    message: `Credited ${done}.${skipped ? ` ${skipped} already had credit or came through a Shipping Center, and were left alone.` : ""}`,
  };
}

/** Set, change or clear the partner on one load, from the shipment page. */
export async function setShipmentPartner(_prev: RebateState, fd: FormData): Promise<RebateState> {
  const shipment_id = str(fd, "shipment_id");
  if (!shipment_id) return { error: "Missing shipment." };
  const partner_id = str(fd, "partner_id");
  const source = str(fd, "source") ?? "manual";
  if (partner_id && !SOURCES.has(source)) return { error: "Pick how they earned it." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: before } = await supabase.from("shipments").select("partner_id").eq("id", shipment_id).maybeSingle();
  const { error } = await supabase
    .from("shipments")
    .update(
      partner_id
        ? {
            partner_id,
            partner_credit_source: source,
            partner_credited_at: new Date().toISOString(),
            partner_credited_by: user?.id ?? null,
          }
        : { partner_id: null, partner_credit_source: null, partner_credited_at: null, partner_credited_by: null },
    )
    .eq("id", shipment_id);
  if (error) {
    if (/shipments_ship_center_no_partner_credit/.test(error.message)) {
      return { error: "This load came through a GSC Shipping Center, so it can't earn partner credit." };
    }
    return { error: error.message };
  }
  await logActivity(supabase, {
    action: "updated",
    entityType: "shipment",
    entityId: shipment_id,
    summary: partner_id ? "Credited to a partner" : "Removed partner credit",
    details: { partner_id, from: before?.partner_id ?? null, source: partner_id ? source : null },
  });
  touch([partner_id, before?.partner_id], [shipment_id]);
  return { error: null, ok: true, message: partner_id ? "Saved." : "Credit removed." };
}

/**
 * Freeze the quarter's statement: rebuilt here from the database at the moment
 * of issue (never from what the page showed), then written with its lines in
 * one transaction. The unique index on lines stops a load being paid twice.
 */
export async function issueRebateStatement(_prev: RebateState, fd: FormData): Promise<RebateState> {
  const partner_id = str(fd, "partner_id");
  const quarter = parseQuarter(str(fd, "quarter"));
  if (!partner_id || !quarter) return { error: "Missing partner or quarter." };
  if (quarter.start > todayYMD()) return { error: "That quarter hasn't started." };
  const supabase = await createClient();
  const loaded = await loadRebateDraft(supabase, partner_id, quarter);
  if (!loaded) return { error: "Partner not found." };
  const { draft, partner } = loaded;
  if (draft.blockers.length) return { error: draft.blockers.join(" ") };
  const expected = str(fd, "expected_total");
  if (expected != null && Number(expected) !== draft.totals.rebate) {
    return { error: "The numbers changed since this page loaded (a payment or a credit came in). Reload and check it again." };
  }
  const { data: id, error } = await supabase.rpc("issue_rebate_statement", {
    p_partner_id: partner_id,
    p_quarter: quarter.label,
    p_period_start: quarter.start,
    p_period_end: quarter.end,
    p_rebate_pct: draft.rebatePct!,
    p_commission_basis: partner.commission_basis,
    p_lines: draft.lines.map((l) => ({
      shipment_id: l.shipment_id,
      tms_reference_id: l.tms_reference_id,
      exhibitor_name: l.exhibitor_name,
      show_name: l.show_name,
      invoice_nos: l.invoice_nos,
      paid_on: l.paid_on,
      billed: l.billed,
      cost: l.cost,
      margin: l.margin,
      rebate: l.rebate,
    })),
  });
  if (error) {
    if (/row-level security|permission denied/i.test(error.message)) return { error: "Only an admin can issue a rebate statement." };
    if (/duplicate key/i.test(error.message)) return { error: "A load on this is already on another statement, or the quarter was just issued. Reload." };
    return { error: error.message };
  }
  await logActivity(supabase, {
    action: "created",
    entityType: "partner",
    entityId: partner_id,
    summary: `Issued the ${quarterName(quarter)} rebate statement: ${draft.totals.loads} loads, $${draft.totals.rebate.toFixed(2)}`,
    details: { statement_id: id },
  });
  touch([partner_id]);
  return { error: null, ok: true, message: "Issued." };
}

/** The rep emailed the statement to the partner. Counts as an email touch. */
export async function markRebateSent(fd: FormData) {
  const id = str(fd, "statement_id");
  const partner_id = str(fd, "partner_id");
  if (!id || !partner_id) return;
  const supabase = await createClient();
  const { data: st } = await supabase
    .from("partner_rebate_statements")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .select("quarter")
    .maybeSingle();
  if (!st) return;
  await supabase.from("partner_touches").insert({
    partner_id,
    channel: "email",
    reached: false,
    note: `Sent the ${st.quarter} rebate statement.`,
  });
  touch([partner_id]);
}

export async function markRebatePaid(_prev: RebateState, fd: FormData): Promise<RebateState> {
  const id = str(fd, "statement_id");
  const partner_id = str(fd, "partner_id");
  const paid_on = str(fd, "paid_on");
  if (!id || !partner_id) return { error: "Missing statement." };
  if (!paid_on || !/^\d{4}-\d{2}-\d{2}$/.test(paid_on)) return { error: "Enter the date it was paid." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("partner_rebate_statements")
    .update({ status: "paid", paid_on, paid_ref: str(fd, "paid_ref"), paid_by: user?.id ?? null })
    .eq("id", id)
    .select("quarter, rebate_total");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Only an admin can mark a rebate paid." };
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: partner_id,
    summary: `Marked the ${data[0].quarter} rebate paid ($${Number(data[0].rebate_total).toFixed(2)})`,
  });
  touch([partner_id]);
  return { error: null, ok: true, message: "Marked paid." };
}

/** Void an unpaid statement: its loads go back to waiting for the next one. */
export async function voidRebateStatement(fd: FormData) {
  const id = str(fd, "statement_id");
  const partner_id = str(fd, "partner_id");
  if (!id || !partner_id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("partner_rebate_statements").delete().eq("id", id).neq("status", "paid").select("quarter");
  if (data?.length) {
    await logActivity(supabase, {
      action: "deleted",
      entityType: "partner",
      entityId: partner_id,
      summary: `Voided the ${data[0].quarter} rebate statement`,
    });
  }
  touch([partner_id]);
}
