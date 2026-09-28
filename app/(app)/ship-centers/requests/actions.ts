"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { pullShipRequests } from "@/lib/ship-pull";
import { pushShipStatus } from "@/lib/ship-push";
import { LOAD_NUMBER, legName, quotable, shipmentForLeg } from "@/lib/ship-intake";
import { OFFICE_PHONE, emailConfigured, legFreight, legRoute, quoteEmail, sendQuoteEmail } from "@/lib/ship-quote";
import { syncLoadNumber } from "@/lib/tms-sync";

/**
 * The GSC Shipping Center requests inbox: quote, book, close. Every write goes
 * through the signed-in person's own client, so RLS has the last word; only
 * "Check now" uses the service role (inside lib/ship-pull.ts), to run the same
 * pull as the 15 minute sync.
 */

export type InboxState = { error: string | null; ok?: boolean; message?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function me(supabase: Supabase) {
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) return null;
  const { data: p } = await supabase.from("profiles").select("id, full_name, email, phone").eq("id", id).maybeSingle();
  return p ?? { id, full_name: null, email: null, phone: null };
}

function touch(id?: string) {
  revalidatePath("/ship-centers/requests");
  if (id) revalidatePath(`/ship-centers/requests/${id}`);
}

/** The exhibitor's page catches up now, not at the next 15 minute sync. */
function tellExhibitor() {
  after(() => pushShipStatus().then(() => undefined));
}

async function loadRequest(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("ship_request_inbox")
    .select(
      "id, public_ref, partner_id, show_id, show_snapshot, company, contact_name, email, mobile, booth, closed, assigned_to, ship_request_legs(*)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------

export async function checkNow(): Promise<InboxState> {
  const supabase = await createClient();
  if (!(await me(supabase))) return { error: "Sign in again." };
  const r = await pullShipRequests();
  touch();
  if (r.skipped) return { error: "The pull is not set up yet (TRADE_SHOW_PULL_SECRET)." };
  if (!r.ok) return { error: `The pull failed: ${r.error}` };
  return { error: null, ok: true, message: r.stored ? `${r.stored} new request${r.stored === 1 ? "" : "s"}.` : "Nothing new." };
}

export async function assignToMe(fd: FormData): Promise<void> {
  const id = String(fd.get("request_id") ?? "");
  const supabase = await createClient();
  const who = await me(supabase);
  if (!who || !id) return;
  await supabase.from("ship_request_inbox").update({ assigned_to: who.id }).eq("id", id);
  touch(id);
}

// ---------------------------------------------------------------------------
// Quote: one email with a price per leg. Amounts stay in the CRM.
// ---------------------------------------------------------------------------

export async function sendQuote(_prev: InboxState, fd: FormData): Promise<InboxState> {
  const id = String(fd.get("request_id") ?? "");
  const mode = fd.get("mode") === "manual" ? "manual" : "email";
  const note = String(fd.get("note") ?? "").trim() || null;
  const supabase = await createClient();
  const who = await me(supabase);
  if (!who) return { error: "Sign in again." };
  const req = await loadRequest(supabase, id);
  if (!req) return { error: "Request not found." };
  if (req.closed) return { error: "This request is closed." };
  if (!req.email) return { error: "This request has no email address." };

  const legs = (req.ship_request_legs ?? []).filter((l) => quotable(l) && l.stage !== "booked");
  const inbound = (req.ship_request_legs ?? []).filter((l) => l.direction === "inbound").length;
  const priced: { leg: (typeof legs)[number]; amount: number }[] = [];
  for (const l of legs) {
    const raw = String(fd.get(`amount_${l.id}`) ?? "").replace(/[$,\s]/g, "");
    if (!raw) continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || !/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { error: `${legName(l.direction, l.seq, inbound)}: enter the price as a number, like 687.50.` };
    }
    priced.push({ leg: l, amount });
  }
  if (!priced.length) return { error: "Enter a price for at least one shipment." };

  const show = (req.show_snapshot ?? {}) as Record<string, unknown>;
  const msg = quoteEmail({
    publicRef: req.public_ref,
    showName: String(show.show_name ?? "your show"),
    year: String(show.year ?? ""),
    gscName: String(show.gsc_name ?? "the show's general service contractor"),
    booth: req.booth,
    contactName: req.contact_name,
    lines: priced.map(({ leg, amount }) => ({
      name: legName(leg.direction, leg.seq, inbound),
      route: legRoute(leg),
      freight: legFreight(leg),
      amount,
    })),
    note,
    staffName: who.full_name,
    staffPhone: who.phone,
    officePhone: OFFICE_PHONE,
  });

  if (mode === "email") {
    if (!emailConfigured()) return { error: "Email is not set up in the CRM yet. Send it from Outlook and use \"I sent it myself\"." };
    const sent = await sendQuoteEmail(req.email, msg, {
      fromName: `${String(show.gsc_name ?? "DTS")} Shipping (arranged by DTS)`,
      replyTo: who.email,
    });
    if (!sent.ok) return { error: sent.error ?? "The email did not send." };
  }

  const { error: qErr } = await supabase.from("ship_quotes").insert(
    priced.map(({ leg, amount }) => ({ leg_id: leg.id, amount, note, sent_via: mode, sent_to: req.email })),
  );
  if (qErr) return { error: `${mode === "email" ? "The email went out, but the" : "The"} price was not saved: ${qErr.message}` };
  await supabase
    .from("ship_request_legs")
    .update({ stage: "quoted" })
    .in("id", priced.map((p) => p.leg.id))
    .in("stage", ["new", "quoted"]);
  if (!req.assigned_to) await supabase.from("ship_request_inbox").update({ assigned_to: who.id }).eq("id", id);
  await logActivity(supabase, {
    action: "updated",
    entityType: "ship_request",
    entityId: id,
    entityLabel: req.public_ref,
    summary: `Quote ${mode === "email" ? "emailed" : "sent from own mailbox"} for ${priced.length} shipment${priced.length === 1 ? "" : "s"}`,
  });
  tellExhibitor();
  touch(id);
  return { error: null, ok: true, message: mode === "email" ? `Quote emailed to ${req.email}.` : "Quote recorded." };
}

// ---------------------------------------------------------------------------
// Booked: the load number only. The TMS sync fills carrier, PRO and dates.
// ---------------------------------------------------------------------------

export async function bookLeg(_prev: InboxState, fd: FormData): Promise<InboxState> {
  const legId = String(fd.get("leg_id") ?? "");
  const load = String(fd.get("load_number") ?? "").trim();
  if (!LOAD_NUMBER.test(load)) return { error: "Enter the load number from Hyperion." };
  const supabase = await createClient();
  const who = await me(supabase);
  if (!who) return { error: "Sign in again." };

  const { data: leg } = await supabase.from("ship_request_legs").select("*").eq("id", legId).maybeSingle();
  if (!leg) return { error: "Shipment not found." };
  if (leg.stage === "booked") return { error: "Already booked." };
  if (leg.stage === "cancelled") return { error: "This shipment was cancelled." };
  const req = await loadRequest(supabase, leg.request_id);
  if (!req || req.closed) return { error: "This request is closed." };

  const { data: existing } = await supabase
    .from("shipments")
    .select("id, ship_leg_id, partner_id, show_id, booth_number")
    .eq("tms_reference_id", load)
    .maybeSingle();

  let shipmentId: string;
  if (existing) {
    if (existing.ship_leg_id && existing.ship_leg_id !== leg.id) return { error: `Load ${load} is already booked for another request.` };
    if (existing.partner_id) return { error: `Load ${load} carries partner credit. Shipping Center loads can't; check the load number.` };
    const { error } = await supabase
      .from("shipments")
      .update({
        source: "ship_center",
        ship_leg_id: leg.id,
        ...(existing.show_id ? {} : { show_id: req.show_id, show_auto_linked: false }),
        ...(existing.booth_number ? {} : { booth_number: req.booth }),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    shipmentId = existing.id;
  } else {
    // The exhibitor, found or added by company name, as the TMS ingest does.
    let exhibitor_id: string | null = null;
    if (req.company) {
      const found = await supabase.from("exhibitors").select("id").ilike("company_name", req.company).limit(1).maybeSingle();
      exhibitor_id =
        found.data?.id ??
        (
          await supabase
            .from("exhibitors")
            .insert({
              company_name: req.company,
              primary_contact_name: req.contact_name,
              primary_contact_email: req.email,
              primary_contact_phone: req.mobile,
            })
            .select("id")
            .single()
        ).data?.id ??
        null;
    }
    const { data: created, error } = await supabase
      .from("shipments")
      .insert({ ...shipmentForLeg(leg, req, load), exhibitor_id })
      .select("id")
      .single();
    if (error || !created) return { error: error?.message ?? "The shipment was not created." };
    shipmentId = created.id;
  }

  await supabase.from("ship_request_legs").update({ stage: "booked" }).eq("id", leg.id);
  await logActivity(supabase, {
    action: "updated",
    entityType: "ship_request",
    entityId: req.id,
    entityLabel: req.public_ref,
    summary: `Booked ${legName(leg.direction, leg.seq)} as load ${load}`,
    details: { shipment_id: shipmentId },
  });
  // Carrier, PRO and dates from the TMS, once the response has gone.
  after(async () => {
    await syncLoadNumber(load).catch(() => false);
    await pushShipStatus();
  });
  touch(req.id);
  revalidatePath("/shipments");
  return { error: null, ok: true, message: `Booked as load ${load}.` };
}

// ---------------------------------------------------------------------------
// Cancel a shipment, or close the whole request
// ---------------------------------------------------------------------------

export async function cancelLeg(fd: FormData): Promise<void> {
  const legId = String(fd.get("leg_id") ?? "");
  const supabase = await createClient();
  if (!(await me(supabase))) return;
  const { data: leg } = await supabase.from("ship_request_legs").select("id, request_id, stage").eq("id", legId).maybeSingle();
  if (!leg || leg.stage === "booked") return;
  await supabase.from("ship_request_legs").update({ stage: "cancelled" }).eq("id", legId);
  tellExhibitor();
  touch(leg.request_id);
}

export async function closeRequest(_prev: InboxState, fd: FormData): Promise<InboxState> {
  const id = String(fd.get("request_id") ?? "");
  const how = fd.get("closed") === "rejected" ? "rejected" : "cancelled";
  const note = String(fd.get("closed_note") ?? "").trim() || null;
  if (how === "rejected" && !note) return { error: "Say why it was turned down (only staff see this)." };
  const supabase = await createClient();
  const who = await me(supabase);
  if (!who) return { error: "Sign in again." };
  const req = await loadRequest(supabase, id);
  if (!req) return { error: "Request not found." };
  if (req.closed) return { error: "Already closed." };
  if ((req.ship_request_legs ?? []).some((l) => l.stage === "booked")) {
    return { error: "A shipment on this request is booked. Cancel the load in Hyperion first, then cancel the rest here." };
  }
  const { error } = await supabase
    .from("ship_request_inbox")
    .update({ closed: how, closed_note: note, closed_at: new Date().toISOString(), closed_by: who.id })
    .eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("ship_request_legs").update({ stage: "cancelled" }).eq("request_id", id).neq("stage", "booked");
  await logActivity(supabase, {
    action: "updated",
    entityType: "ship_request",
    entityId: id,
    entityLabel: req.public_ref,
    summary: how === "rejected" ? "Turned down" : "Cancelled",
    details: note ? { note } : null,
  });
  tellExhibitor();
  touch(id);
  return { error: null, ok: true, message: how === "rejected" ? "Turned down." : "Cancelled." };
}

// ---------------------------------------------------------------------------
// "Request a change" messages from the exhibitor
// ---------------------------------------------------------------------------

export async function markChangeHandled(fd: FormData): Promise<void> {
  const changeId = String(fd.get("change_id") ?? "");
  const note = String(fd.get("handled_note") ?? "").trim() || null;
  const supabase = await createClient();
  const who = await me(supabase);
  if (!who || !changeId) return;
  const { data: ch } = await supabase
    .from("ship_change_requests")
    .update({ handled_at: new Date().toISOString(), handled_by: who.id, handled_note: note })
    .eq("id", changeId)
    .is("handled_at", null)
    .select("request_id")
    .maybeSingle();
  if (ch) touch(ch.request_id);
}
