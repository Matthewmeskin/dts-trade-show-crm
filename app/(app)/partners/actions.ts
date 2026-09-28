"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { pacificWallToIso } from "@/lib/format";
import { nudgePublicSync } from "@/lib/public-sync";
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

// ---------------------------------------------------------------------------
// Clients and pilots
// ---------------------------------------------------------------------------

/** Exhibitor lookup for the "add a client" box. Top matches by name. */
export async function searchExhibitors(q: string): Promise<{ id: string; name: string }[]> {
  const term = q.trim().replace(/[%_,()]/g, " ").trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("exhibitors")
    .select("id, company_name")
    .ilike("company_name", `%${term}%`)
    .order("company_name")
    .limit(12);
  return (data ?? []).map((e) => ({ id: e.id, name: e.company_name }));
}

/**
 * Link an exhibitor as this partner's client. Picks an existing exhibitor, or
 * creates one by name when the admin confirms it isn't in the CRM yet - so the
 * same company doesn't end up in the directory twice.
 */
export async function addPartnerClient(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const partner_id = str(fd, "partner_id");
  let exhibitor_id = str(fd, "exhibitor_id");
  const newName = str(fd, "new_company_name");
  if (!partner_id) return { error: "Missing partner." };
  const supabase = await createClient();

  if (!exhibitor_id && newName) {
    const { data: same } = await supabase
      .from("exhibitors")
      .select("id")
      .ilike("company_name", newName.replace(/[%_]/g, "\\$&"))
      .limit(1);
    if (same?.length) exhibitor_id = same[0].id;
    else {
      const { data: created, error } = await supabase
        .from("exhibitors")
        .insert({ company_name: newName })
        .select("id")
        .single();
      if (error) return { error: error.message };
      exhibitor_id = created.id;
      await logActivity(supabase, {
        action: "created",
        entityType: "exhibitor",
        entityId: created.id,
        entityLabel: newName,
        summary: "Added as a partner's client",
      });
    }
  }
  if (!exhibitor_id) return { error: "Pick the client from the list, or add them as a new exhibitor." };

  const { error } = await supabase
    .from("partner_clients")
    .upsert({ partner_id, exhibitor_id, in_pilot: fd.get("in_pilot") != null }, { onConflict: "partner_id,exhibitor_id" });
  if (error) return { error: error.message };
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: partner_id,
    summary: "Linked a client exhibitor",
    details: { exhibitor_id },
  });
  touchPaths(partner_id);
  revalidatePath(`/exhibitors/${exhibitor_id}`);
  return { error: null, ok: true };
}

export async function setClientPilot(fd: FormData) {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("partner_clients").update({ in_pilot: str(fd, "in_pilot") === "true" }).eq("id", id);
  touchPaths(partner_id);
}

export async function removePartnerClient(fd: FormData) {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("partner_clients").delete().eq("id", id);
  touchPaths(partner_id);
}

export async function setShowPilot(fd: FormData) {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("partner_shows").update({ is_pilot: str(fd, "is_pilot") === "true" }).eq("id", id);
  touchPaths(partner_id);
}

// ---------------------------------------------------------------------------
// The weekly pilot report
// ---------------------------------------------------------------------------

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export async function saveReportSettings(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const id = str(fd, "partner_id");
  if (!id) return { error: "Missing partner." };
  const emails = (str(fd, "report_to") ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const bad = emails.filter((e) => !EMAIL.test(e));
  if (bad.length) return { error: `Not an email address: ${bad.join(", ")}` };
  const report_active = fd.get("report_active") != null;
  if (report_active && !emails.length) return { error: "Add who gets the report before turning it on." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ report_to: emails.length ? emails.join(", ") : null, report_active })
    .eq("id", id);
  if (error) return { error: error.message };
  touchPaths(id);
  return { error: null, ok: true };
}

/**
 * The rep sent this week's report from their own mailbox. Record it as a touch
 * so it counts, and so the worklist stops asking for it until next Monday.
 */
export async function markReportSent(fd: FormData) {
  const id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase.from("partners").update({ last_report_sent_at: now }).eq("id", id);
  await supabase.from("partner_touches").insert({
    partner_id: id,
    channel: "email",
    reached: false,
    note: `Sent the weekly client freight status report${str(fd, "week_of") ? ` (week of ${str(fd, "week_of")})` : ""}.`,
  });
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: id,
    summary: "Sent the weekly pilot report",
  });
  touchPaths(id);
  revalidatePath(`/partners/${id}/report`);
}

// ---------------------------------------------------------------------------
// Cobranded show pages and partner terms
// ---------------------------------------------------------------------------

/**
 * The partner's code, public name and logo, and whether cobranding is on.
 * Only these (plus type and website) ever reach the public site, through the
 * partner export; turning cobranding off takes the partner's pages down on the
 * next sync, and their kit links fall back to the plain show pages.
 */
export async function saveCobrand(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const id = str(fd, "partner_id");
  if (!id) return { error: "Missing partner." };
  const code = (str(fd, "code") ?? "").toLowerCase() || null;
  const public_name = str(fd, "public_name");
  const logo_url = str(fd, "logo_url");
  const cobrand_active = fd.get("cobrand_active") != null;
  const fieldErrors: Record<string, string> = {};
  if (code && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(code)) fieldErrors.code = "Lowercase letters, numbers and single hyphens.";
  if (code && (code.length < 3 || code.length > 40)) fieldErrors.code = "3 to 40 characters.";
  // Words the GSC Shipping Center's exhibitor pages use for themselves (/ship/<word>/).
  if (code && ["confirm", "admin", "account", "terms", "privacy", "link", "api"].includes(code))
    fieldErrors.code = "That word is used by the exhibitor site. Pick another code.";
  if (logo_url && !/^https:\/\//i.test(logo_url)) fieldErrors.logo_url = "The logo has to be an https:// link.";
  if (cobrand_active && !code) fieldErrors.code = "Cobranding needs a code.";
  if (cobrand_active && !public_name) fieldErrors.public_name = "Cobranding needs the name exhibitors will see.";
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: before } = await supabase.from("partners").select("code, cobrand_active").eq("id", id).maybeSingle();
  // A code in a printed kit is hard to take back. Changing it once pages are
  // live breaks those links (they fall back to the plain page), so say so.
  if (before?.code && code !== before.code && before.cobrand_active && fd.get("confirm_code_change") == null) {
    return {
      error: `Links already sent with "${before.code}" will stop showing this partner's branding. Tick "Change the code anyway" to confirm.`,
      fieldErrors: { code: "Changing a live code breaks kit links." },
    };
  }
  const { error } = await supabase
    .from("partners")
    .update({ code, public_name, logo_url, cobrand_active })
    .eq("id", id);
  if (error) {
    return /partners_code_unique|duplicate key/i.test(error.message)
      ? { error: "Another partner already has that code.", fieldErrors: { code: "Already taken." } }
      : { error: error.message };
  }
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: id,
    summary: cobrand_active ? `Cobranding on (code ${code})` : "Cobranding off",
  });
  nudgePublicSync();
  touchPaths(id);
  return { error: null, ok: true };
}

export async function setShowCobranded(fd: FormData) {
  const id = str(fd, "id");
  const partner_id = str(fd, "partner_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("partner_shows").update({ cobranded: str(fd, "cobranded") === "true" }).eq("id", id);
  nudgePublicSync();
  touchPaths(partner_id);
}

/** Rebate or markup terms. Internal only - never exported. */
export async function saveTerms(_prev: PartnerState, fd: FormData): Promise<PartnerState> {
  const id = str(fd, "partner_id");
  if (!id) return { error: "Missing partner." };
  const incentive_model = str(fd, "incentive_model");
  const commission_basis = str(fd, "commission_basis");
  const num = (k: string) => {
    const v = str(fd, k);
    if (v == null) return null;
    const n = Number(v.replace(/[%\s]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  const rebate_pct = num("rebate_pct");
  const markup_pct = num("markup_pct");
  if (incentive_model && !["rebate", "markup"].includes(incentive_model)) return { error: "Pick rebate or markup." };
  if (commission_basis && !["before_rebate", "after_rebate"].includes(commission_basis)) return { error: "Pick when commission is figured." };
  if (Number.isNaN(rebate_pct) || (rebate_pct != null && (rebate_pct < 0 || rebate_pct > 100))) return { error: "Rebate is a percent of margin, 0 to 100." };
  if (Number.isNaN(markup_pct) || (markup_pct != null && (markup_pct < 0 || markup_pct > 500))) return { error: "Markup is a percent, 0 to 500." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ incentive_model, rebate_pct, markup_pct, commission_basis, terms_note: str(fd, "terms_note") })
    .eq("id", id);
  if (error) return { error: error.message };
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: id,
    summary: `Terms: ${incentive_model ?? "not set"}${incentive_model === "rebate" && rebate_pct != null ? ` ${rebate_pct}% of margin` : ""}${incentive_model === "markup" && markup_pct != null ? ` ${markup_pct}% markup` : ""}`,
  });
  touchPaths(id);
  return { error: null, ok: true };
}

// ---------------------------------------------------------------------------
// GSC manifest
// ---------------------------------------------------------------------------

/**
 * Link a load to a show from the manifest's "possible loads" list. A person
 * decided, so the TMS sync stops managing this link (show_auto_linked false),
 * the same as saving the show on the shipment page.
 */
export async function linkShipmentToShow(fd: FormData) {
  const shipment_id = str(fd, "shipment_id");
  const show_id = str(fd, "show_id");
  const partner_id = str(fd, "partner_id");
  if (!shipment_id || !show_id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .update({ show_id, show_auto_linked: false })
    .eq("id", shipment_id)
    .is("show_id", null);
  if (error) return;
  await logActivity(supabase, {
    action: "updated",
    entityType: "shipment",
    entityId: shipment_id,
    summary: "Linked to a show from a GSC manifest",
    details: { show_id },
  });
  revalidatePath(`/shipments/${shipment_id}`);
  revalidatePath(`/shows/${show_id}`);
  if (partner_id) revalidatePath(`/partners/${partner_id}/manifest`);
  touchPaths(partner_id);
}

/** The rep sent today's manifest for one show. Counts as an email touch. */
export async function markManifestSent(fd: FormData) {
  const partner_show_id = str(fd, "partner_show_id");
  const partner_id = str(fd, "partner_id");
  if (!partner_show_id || !partner_id) return;
  const supabase = await createClient();
  await supabase.from("partner_shows").update({ manifest_sent_at: new Date().toISOString() }).eq("id", partner_show_id);
  await supabase.from("partner_touches").insert({
    partner_id,
    channel: "email",
    reached: false,
    note: `Sent the ${str(fd, "kind") === "outbound" ? "outbound list" : "inbound manifest"}${str(fd, "show_name") ? ` for ${str(fd, "show_name")}` : ""}.`,
  });
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: partner_id,
    summary: `Sent the GSC ${str(fd, "kind") === "outbound" ? "outbound list" : "manifest"}`,
  });
  touchPaths(partner_id);
  revalidatePath(`/partners/${partner_id}/manifest`);
}
