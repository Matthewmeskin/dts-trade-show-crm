"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { pacificWallToIso } from "@/lib/format";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import {
  CALL_STATUSES,
  CHANNELS,
  OUTCOMES,
  PARTNER_TYPES,
  SIGNAL_TYPES,
  STAGES,
  advanceStage,
  bookingBlockers,
  labelOf,
  normalizeWebsite,
  parseImport,
  type Stage,
} from "@/lib/partners";

export type PartnerState = {
  error: string | null;
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  problems?: string[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const oneOf = <T extends { value: string | number }>(list: readonly T[], v: unknown) =>
  list.some((x) => String(x.value) === String(v));

function touchPaths(partnerId?: string | null) {
  revalidatePath("/partners");
  revalidatePath("/partners/worklist");
  if (partnerId) revalidatePath(`/partners/${partnerId}`);
}

/** Move a partner forward if what just happened warrants it. Never backward. */
async function bumpStage(supabase: Supabase, partnerId: string, to: Stage) {
  const { data: p } = await supabase.from("partners").select("stage").eq("id", partnerId).maybeSingle();
  const next = p ? advanceStage(p.stage, to) : null;
  if (next) await supabase.from("partners").update({ stage: next }).eq("id", partnerId);
}

function parsePartner(fd: FormData): { data?: TablesInsert<"partners">; fieldErrors?: Record<string, string> } {
  const name = str(fd, "name");
  const partner_type = str(fd, "partner_type") ?? "exhibit_house";
  const tier = int(fd, "tier");
  const stage = str(fd, "stage") ?? "target";
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Company name is required.";
  if (!oneOf(PARTNER_TYPES, partner_type)) fieldErrors.partner_type = "Pick a partner type.";
  if (tier != null && (tier < 1 || tier > 3)) fieldErrors.tier = "Tier is 1, 2 or 3.";
  if (!oneOf(STAGES, stage)) fieldErrors.stage = "Pick a status.";
  const rawSite = str(fd, "website");
  const website = normalizeWebsite(rawSite);
  if (rawSite && !website) fieldErrors.website = "That doesn't look like a web address.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return {
    data: {
      name: name!,
      partner_type,
      tier,
      website,
      city: str(fd, "city"),
      state: str(fd, "state"),
      client_count: int(fd, "client_count"),
      stage,
      admin_id: str(fd, "admin_id"),
      rep_id: str(fd, "rep_id"),
      next_step: str(fd, "next_step"),
      next_step_on: str(fd, "next_step_on"),
      shipping_pain: str(fd, "shipping_pain"),
      source: str(fd, "source"),
      notes: str(fd, "notes"),
    },
  };
}

const duplicateName = (msg: string) => /partners_name_unique|duplicate key/i.test(msg);

export async function createPartner(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const { data, fieldErrors } = parsePartner(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("partners").insert(data!).select("id").single();
  if (error) {
    return duplicateName(error.message)
      ? { error: `${data!.name} is already on the list.`, fieldErrors: { name: "Already on the list." } }
      : { error: error.message };
  }
  await logActivity(supabase, {
    action: "created",
    entityType: "partner",
    entityId: row.id,
    entityLabel: data!.name,
    summary: `Added ${data!.name} to the partner list`,
  });
  touchPaths();
  redirect(`/partners/${row.id}`);
}

export async function updatePartner(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const id = str(fd, "id");
  if (!id) return { error: "Missing partner." };
  const { data, fieldErrors } = parsePartner(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("partners").update(data!).eq("id", id);
  if (error) {
    return duplicateName(error.message)
      ? { error: "Another partner already has that name.", fieldErrors: { name: "Already on the list." } }
      : { error: error.message };
  }
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: id,
    entityLabel: data!.name,
    summary: "Updated partner details",
  });
  touchPaths(id);
  redirect(`/partners/${id}`);
}

/** Quick status / next-step change from the partner page header. */
export async function setPartnerStatus(fd: FormData) {
  const id = str(fd, "id");
  const stage = str(fd, "stage");
  if (!id || !oneOf(STAGES, stage)) return;
  const supabase = await createClient();
  const patch: TablesUpdate<"partners"> = { stage: stage! };
  if (fd.has("next_step")) {
    patch.next_step = str(fd, "next_step");
    patch.next_step_on = str(fd, "next_step_on");
  }
  await supabase.from("partners").update(patch).eq("id", id);
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "partner",
    entityId: id,
    summary: `Status: ${labelOf(STAGES, stage)}`,
  });
  touchPaths(id);
}

export async function archivePartner(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  const archived = str(fd, "archived") === "true";
  const supabase = await createClient();
  await supabase.from("partners").update({ archived }).eq("id", id);
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "partner",
    entityId: id,
    summary: archived ? "Archived partner" : "Restored partner",
  });
  touchPaths(id);
}

/**
 * Paste the tiered target list from a spreadsheet. Companies already on the
 * list are skipped (matched on name, ignoring case), never overwritten.
 */
export async function importPartners(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const text = String(fd.get("sheet") ?? "");
  const { rows, problems } = parseImport(text);
  if (!rows.length) return { error: problems[0] ?? "Nothing to import.", problems: problems.slice(1) };

  const supabase = await createClient();
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("partners").select("name").order("name").range(from, from + 999);
    for (const r of data ?? []) existing.add(r.name.trim().toLowerCase());
    if (!data || data.length < 1000) break;
  }
  const fresh = rows.filter((r) => !existing.has(r.name.trim().toLowerCase()));
  const skipped = rows.length - fresh.length;
  const admin_id = str(fd, "admin_id");

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase
      .from("partners")
      .insert(fresh.slice(i, i + 500).map((r) => ({ ...r, admin_id, source: r.source ?? str(fd, "source") })));
    if (error) return { error: `Import stopped after ${i} rows: ${error.message}`, problems };
  }

  await logActivity(supabase, {
    action: "created",
    entityType: "partner",
    summary: `Imported ${fresh.length} partner${fresh.length === 1 ? "" : "s"}${skipped ? ` (${skipped} already on the list)` : ""}`,
  });
  touchPaths();
  return {
    error: null,
    ok: true,
    message: `Added ${fresh.length} partner${fresh.length === 1 ? "" : "s"}.${skipped ? ` Skipped ${skipped} already on the list.` : ""}`,
    problems,
  };
}

// ---------------------------------------------------------------------------
// Shows and people
// ---------------------------------------------------------------------------

export async function addPartnerShow(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const partner_id = str(fd, "partner_id");
  const show_id = str(fd, "show_id");
  if (!partner_id || !show_id) return { error: "Pick a show." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_shows")
    .upsert(
      { partner_id, show_id, client_count: int(fd, "client_count"), notes: str(fd, "notes") },
      { onConflict: "partner_id,show_id" },
    );
  if (error) return { error: error.message };
  touchPaths(partner_id);
  return { error: null, ok: true };
}

export async function removePartnerShow(fd: FormData) {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("partner_shows").delete().eq("id", id);
  touchPaths(partner_id);
}

export async function addPartnerContact(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const partner_id = str(fd, "partner_id");
  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  if (!partner_id) return { error: "Missing partner." };
  if (!first_name && !last_name) return { error: "Give the person a name." };
  const supabase = await createClient();
  const { data: p } = await supabase.from("partners").select("name, partner_type").eq("id", partner_id).maybeSingle();
  const { error } = await supabase.from("contacts").insert({
    partner_id,
    first_name,
    last_name,
    title: str(fd, "title"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    company: p?.name ?? null,
    contact_type: p?.partner_type === "gsc" ? "gsc_rep" : "other",
  });
  if (error) return { error: error.message };
  touchPaths(partner_id);
  return { error: null, ok: true };
}

// ---------------------------------------------------------------------------
// Signals and touches - the admin's day
// ---------------------------------------------------------------------------

export async function addSignal(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const partner_id = str(fd, "partner_id");
  const signal_type = str(fd, "signal_type");
  if (!partner_id) return { error: "Pick a partner." };
  if (!oneOf(SIGNAL_TYPES, signal_type)) return { error: "Pick what the signal was." };
  const supabase = await createClient();
  const row: TablesInsert<"partner_signals"> = {
    partner_id,
    signal_type: signal_type!,
    show_id: str(fd, "show_id"),
    note: str(fd, "note"),
  };
  const on = str(fd, "occurred_on");
  if (on) row.occurred_on = on;
  const { error } = await supabase.from("partner_signals").insert(row);
  if (error) return { error: error.message };
  await logActivity(supabase, {
    action: "created",
    entityType: "partner",
    entityId: partner_id,
    summary: `Signal: ${labelOf(SIGNAL_TYPES, signal_type)}`,
  });
  touchPaths(partner_id);
  return { error: null, ok: true };
}

export async function markSignalWorked(fd: FormData) {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const undo = str(fd, "undo") === "true";
  await supabase
    .from("partner_signals")
    .update(undo ? { worked_at: null, worked_by: null } : { worked_at: new Date().toISOString(), worked_by: user?.id ?? null })
    .eq("id", id);
  touchPaths(partner_id);
}

export async function logTouch(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const partner_id = str(fd, "partner_id");
  const channel = str(fd, "channel");
  if (!partner_id) return { error: "Missing partner." };
  if (!oneOf(CHANNELS, channel)) return { error: "Pick how you reached out." };
  const reached = fd.get("reached") != null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_touches")
    .insert({ partner_id, channel: channel!, reached, note: str(fd, "note") });
  if (error) return { error: error.message };

  // Working a signal: the touch closes it, so the morning list shrinks.
  const signal_id = str(fd, "signal_id");
  if (signal_id) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("partner_signals")
      .update({ worked_at: new Date().toISOString(), worked_by: user?.id ?? null })
      .eq("id", signal_id)
      .is("worked_at", null);
  }
  const next_step = str(fd, "next_step");
  if (next_step || str(fd, "next_step_on")) {
    await supabase
      .from("partners")
      .update({ next_step, next_step_on: str(fd, "next_step_on") })
      .eq("id", partner_id);
  }
  await bumpStage(supabase, partner_id, reached ? "conversation" : "working");
  touchPaths(partner_id);
  return { error: null, ok: true };
}

// ---------------------------------------------------------------------------
// Booked calls and the rep's 24-hour loop
// ---------------------------------------------------------------------------

export async function bookCall(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const partner_id = str(fd, "partner_id");
  if (!partner_id) return { error: "Missing partner." };
  const input = {
    q_influence: fd.get("q_influence") != null,
    q_show_120: fd.get("q_show_120") != null,
    q_agreed_time: fd.get("q_agreed_time") != null,
    signal: str(fd, "signal") ?? "",
    shows_note: str(fd, "shows_note") ?? "",
    shipping_pain: str(fd, "shipping_pain") ?? "",
    rep_id: str(fd, "rep_id") ?? "",
    scheduled_at: str(fd, "scheduled_at") ?? "",
  };
  const blockers = bookingBlockers(input);
  if (blockers.length) return { error: "Not bookable yet.", problems: blockers };
  const scheduled_at = pacificWallToIso(input.scheduled_at);
  if (!scheduled_at) return { error: "Set the call time." };

  const supabase = await createClient();
  const { error } = await supabase.from("partner_calls").insert({
    partner_id,
    rep_id: input.rep_id,
    scheduled_at,
    signal: input.signal,
    shows_note: input.shows_note,
    shipping_pain: input.shipping_pain,
    client_count: int(fd, "client_count"),
    contact_id: str(fd, "contact_id"),
    q_influence: input.q_influence,
    q_show_120: input.q_show_120,
    q_agreed_time: input.q_agreed_time,
  });
  if (error) return { error: error.message };

  // The partner now belongs to that rep, and carries the pain for next time.
  const patch: TablesUpdate<"partners"> = { rep_id: input.rep_id, shipping_pain: input.shipping_pain };
  const cc = int(fd, "client_count");
  if (cc != null) patch.client_count = cc;
  await supabase.from("partners").update(patch).eq("id", partner_id);
  await bumpStage(supabase, partner_id, "booked");
  await logActivity(supabase, {
    action: "created",
    entityType: "partner",
    entityId: partner_id,
    summary: "Booked a qualified discovery call",
    details: { rep_id: input.rep_id, scheduled_at },
  });
  touchPaths(partner_id);
  return { error: null, ok: true };
}

/** The rep closes the loop: held with an outcome, no-show, or canceled. */
export async function closeCall(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  const status = str(fd, "status");
  const outcome = str(fd, "outcome");
  if (!id || !partner_id) return { error: "Missing call." };
  if (!oneOf(CALL_STATUSES, status) || status === "booked") return { error: "Say what happened." };
  if (status === "held" && !oneOf(OUTCOMES, outcome)) return { error: "A held call needs an outcome: good fit, next step, or not a fit." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("partner_calls")
    .update({
      status: status!,
      outcome: status === "held" ? outcome : null,
      outcome_note: str(fd, "outcome_note"),
      outcome_at: new Date().toISOString(),
      outcome_by: user?.id ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  if (status === "held") {
    await bumpStage(supabase, partner_id, "held");
    if (outcome === "not_fit") await supabase.from("partners").update({ stage: "not_fit" }).eq("id", partner_id);
  }
  const next_step = str(fd, "next_step");
  if (next_step) {
    await supabase.from("partners").update({ next_step, next_step_on: str(fd, "next_step_on") }).eq("id", partner_id);
  }
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "partner",
    entityId: partner_id,
    summary:
      status === "held"
        ? `Call held — ${labelOf(OUTCOMES, outcome)}`
        : `Call ${labelOf(CALL_STATUSES, status).toLowerCase()}`,
  });
  touchPaths(partner_id);
  return { error: null, ok: true };
}

// ---------------------------------------------------------------------------
// Playbook
// ---------------------------------------------------------------------------

export async function savePlaybookSection(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const key = str(fd, "key");
  const title = str(fd, "title");
  const body = String(fd.get("body") ?? "");
  if (!key || !title) return { error: "A section needs a title." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("playbook_sections")
    .update({ title, body, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq("key", key)
    .select("key");
  if (error) return { error: error.message };
  // RLS hides the row from non-admins, so an empty result means "not allowed".
  if (!data?.length) return { error: "Only admins can edit the playbook." };
  await logActivity(supabase, {
    action: "updated",
    entityType: "playbook",
    summary: `Edited playbook: ${title}`,
  });
  revalidatePath("/partners/playbook");
  return { error: null, ok: true };
}
