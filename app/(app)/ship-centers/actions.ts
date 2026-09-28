"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { nudgePublicSync } from "@/lib/public-sync";
import { composeFreightAddress, FREIGHT_ADDRESS_KEYS, type FreightAddressParts } from "@/lib/freight";
import { effectiveStatus, isValidSlug, verifyBlockers } from "@/lib/logistics";
import { evergreenName, gscMatches, gscNameFor } from "@/lib/ship-center";
import type { TablesUpdate } from "@/lib/database.types";

/**
 * GSC Shipping Centers: the one place a GSC's shows are set up.
 *
 * A ship_shows row is the statement "this GSC runs this show through its
 * Shipping Center". Adding a show creates it switched off; the show is set up
 * on one page (dates, where freight goes, verify); an admin turns it on. The
 * database has the last word on every rule here: admin-only ship_shows
 * writes, the verify trigger, permanent partner codes.
 */

export type ShipState = {
  error: string | null;
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  blockers?: string[];
  /** A series already has this web address: offer to use it. */
  slugTaken?: { name: string };
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function isAdmin(supabase: Supabase): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return false;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", sub).maybeSingle();
  return me?.role === "admin";
}

async function loadGsc(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("partners")
    .select("id, name, public_name, code, partner_type, archived")
    .eq("id", id)
    .maybeSingle();
  return data;
}

function touch(partnerId: string, showId?: string) {
  revalidatePath("/ship-centers");
  revalidatePath(`/ship-centers/${partnerId}`);
  revalidatePath(`/partners/${partnerId}`);
  if (showId) {
    revalidatePath(`/ship-centers/${partnerId}/shows/${showId}`);
    revalidatePath(`/shows/${showId}`);
  }
}

// ---------------------------------------------------------------------------
// The GSC's own details: its kit link code and what exhibitors see
// ---------------------------------------------------------------------------

export async function saveShipCenter(_prev: ShipState, fd: FormData): Promise<ShipState> {
  const id = str(fd, "partner_id");
  if (!id) return { error: "Missing GSC." };
  const code = (str(fd, "code") ?? "").toLowerCase() || null;
  const public_name = str(fd, "public_name");
  const ship_phone = str(fd, "ship_phone");
  const ship_email = str(fd, "ship_email");
  const logo_url = str(fd, "logo_url");

  const fieldErrors: Record<string, string> = {};
  if (!code) fieldErrors.code = "The kit link needs a code.";
  else if (!CODE.test(code) || code.length < 3 || code.length > 40)
    fieldErrors.code = "3 to 40 lowercase letters, numbers and single hyphens.";
  if (ship_email && !EMAIL.test(ship_email)) fieldErrors.ship_email = "That doesn't look like an email address.";
  if (logo_url && !/^https:\/\//i.test(logo_url)) fieldErrors.logo_url = "Use an https:// link to the logo image.";
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ code, public_name, ship_phone, ship_email, logo_url })
    .eq("id", id);
  if (error) {
    if (/partners_code_unique|duplicate key/i.test(error.message))
      return { error: "Another partner already uses that code.", fieldErrors: { code: "Already taken." } };
    // The permanent-code trigger's own messages are written for people.
    if (/retired|kit links/i.test(error.message)) return { error: error.message, fieldErrors: { code: "Can't use this code." } };
    return { error: error.message };
  }
  await logActivity(supabase, {
    action: "updated",
    entityType: "partner",
    entityId: id,
    summary: `Updated the Shipping Center details (code ${code})`,
  });
  nudgePublicSync();
  touch(id);
  return { error: null, ok: true, message: "Saved." };
}

// ---------------------------------------------------------------------------
// Adding a show: a new one, or one already in the CRM that this GSC runs
// ---------------------------------------------------------------------------

async function linkShow(supabase: Supabase, partnerId: string, showId: string) {
  const { error } = await supabase
    .from("ship_shows")
    .upsert({ partner_id: partnerId, show_id: showId, enabled: false }, { onConflict: "partner_id,show_id", ignoreDuplicates: true });
  if (error) return error;
  // Keep the partner's own show list in step, so manifests and reports see it.
  await supabase
    .from("partner_shows")
    .upsert({ partner_id: partnerId, show_id: showId }, { onConflict: "partner_id,show_id", ignoreDuplicates: true });
  return null;
}

function linkError(message: string): ShipState {
  if (/row-level security|permission denied/i.test(message))
    return { error: "Only an admin can add shows to a Shipping Center during the pilot." };
  return { error: message };
}

export async function addNewShipShow(_prev: ShipState, fd: FormData): Promise<ShipState> {
  const partnerId = str(fd, "partner_id");
  if (!partnerId) return { error: "Missing GSC." };
  const show_name = str(fd, "show_name");
  const start = str(fd, "show_start_date");
  const end = str(fd, "show_end_date");
  const kit = str(fd, "exhibitor_manual_url");

  const fieldErrors: Record<string, string> = {};
  if (!show_name) fieldErrors.show_name = "Name the show.";
  if (!start) fieldErrors.show_start_date = "When does it open?";
  if (!end) fieldErrors.show_end_date = "When does it close?";
  if (start && end && end < start) fieldErrors.show_end_date = "The show can't close before it opens.";
  if (kit && !/^https?:\/\//i.test(kit)) fieldErrors.exhibitor_manual_url = "Paste the full link, starting with https://";
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const gsc = await loadGsc(supabase, partnerId);
  if (!gsc) return { error: "GSC not found." };
  if (!gsc.code) return { error: "Save the GSC's kit link code first." };
  if (!(await isAdmin(supabase))) return { error: "Only an admin can add shows to a Shipping Center during the pilot." };

  const { data: show, error } = await supabase
    .from("shows")
    .insert({
      show_name: show_name!,
      show_start_date: start,
      show_end_date: end,
      edition_year: Number(start!.slice(0, 4)),
      venue_id: str(fd, "venue_id"),
      exhibitor_manual_url: kit,
      decorator: gscNameFor(gsc),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const linkErr = await linkShow(supabase, partnerId, show.id);
  if (linkErr) return linkError(linkErr.message);

  await logActivity(supabase, {
    action: "created",
    entityType: "show",
    entityId: show.id,
    entityLabel: show_name,
    summary: `Created ${show_name} for ${gscNameFor(gsc)}'s Shipping Center`,
  });
  touch(partnerId, show.id);
  redirect(`/ship-centers/${partnerId}/shows/${show.id}?added=1`);
}

export async function addExistingShipShow(_prev: ShipState, fd: FormData): Promise<ShipState> {
  const partnerId = str(fd, "partner_id");
  const showId = str(fd, "show_id");
  if (!partnerId) return { error: "Missing GSC." };
  if (!showId) return { error: "Pick a show." };

  const supabase = await createClient();
  const gsc = await loadGsc(supabase, partnerId);
  if (!gsc) return { error: "GSC not found." };
  if (!gsc.code) return { error: "Save the GSC's kit link code first." };
  if (!(await isAdmin(supabase))) return { error: "Only an admin can add shows to a Shipping Center during the pilot." };

  const { data: show } = await supabase.from("shows").select("id, show_name, decorator").eq("id", showId).maybeSingle();
  if (!show) return { error: "Show not found." };

  const name = gscNameFor(gsc);
  if (show.decorator && !gscMatches(show.decorator, gsc)) {
    if (fd.get("confirm_gsc") == null) {
      return {
        error: `${show.show_name} lists ${show.decorator} as its GSC. A Shipping Center only runs on shows ${name} runs. If the CRM is out of date, tick the box to record ${name} as the GSC.`,
        fieldErrors: { confirm_gsc: "needed" },
      };
    }
  }
  if (!show.decorator || !gscMatches(show.decorator, gsc)) {
    const { error } = await supabase.from("shows").update({ decorator: name }).eq("id", showId);
    if (error) return { error: error.message };
  }

  const linkErr = await linkShow(supabase, partnerId, showId);
  if (linkErr) return linkError(linkErr.message);

  await logActivity(supabase, {
    action: "updated",
    entityType: "show",
    entityId: showId,
    entityLabel: show.show_name,
    summary: `Added to ${name}'s Shipping Center`,
    details: { previous_gsc: show.decorator },
  });
  touch(partnerId, showId);
  redirect(`/ship-centers/${partnerId}/shows/${showId}?added=1`);
}

// ---------------------------------------------------------------------------
// On and off
// ---------------------------------------------------------------------------

export async function setShipShowEnabled(fd: FormData) {
  const partnerId = str(fd, "partner_id");
  const showId = str(fd, "show_id");
  if (!partnerId || !showId) return;
  const enabled = str(fd, "enabled") === "true";
  const supabase = await createClient();

  if (enabled) {
    // Only a show whose details are verified and fresh goes on.
    const [{ data: show }, { data: logistics }] = await Promise.all([
      supabase.from("shows").select("show_end_date").eq("id", showId).maybeSingle(),
      supabase.from("show_public_logistics").select("verification_status, last_verified_at").eq("show_id", showId).maybeSingle(),
    ]);
    if (effectiveStatus(logistics ?? null, show?.show_end_date ?? null) !== "verified") return;
  }

  const { error } = await supabase
    .from("ship_shows")
    .update({ enabled })
    .eq("partner_id", partnerId)
    .eq("show_id", showId);
  if (error) {
    console.error("[ship-centers] toggle failed:", error.message);
    return;
  }
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "show",
    entityId: showId,
    summary: enabled ? "Shipping Center turned on" : "Shipping Center turned off",
    details: { partner_id: partnerId },
  });
  nudgePublicSync();
  touch(partnerId, showId);
}

// ---------------------------------------------------------------------------
// One page to set a show up: dates, where freight goes, verify, turn on
// ---------------------------------------------------------------------------

const SHOW_DATE_FIELDS = [
  "show_start_date",
  "show_end_date",
  "move_in_start",
  "move_in_end",
  "move_out_start",
  "move_out_end",
  "advance_warehouse_open",
  "advance_warehouse_cutoff",
  "direct_to_show_start",
  "direct_to_show_end",
] as const;

function freight(fd: FormData, prefix: "advance_warehouse" | "direct_to_show") {
  const parts: FreightAddressParts = {};
  for (const k of FREIGHT_ADDRESS_KEYS) parts[k] = str(fd, `${prefix}_${k}`);
  const address = composeFreightAddress(parts).oneLine ?? str(fd, `${prefix}_address_legacy`);
  const out: Record<string, string | null> = { [`${prefix}_address`]: address };
  for (const k of FREIGHT_ADDRESS_KEYS) out[`${prefix}_${k}`] = parts[k] ?? null;
  return out;
}

export async function saveShipSetup(_prev: ShipState, fd: FormData): Promise<ShipState> {
  const partnerId = str(fd, "partner_id");
  const showId = str(fd, "show_id");
  if (!partnerId || !showId) return { error: "Missing show." };
  const verify = str(fd, "mode") === "verify";

  const show_name = str(fd, "show_name");
  const fieldErrors: Record<string, string> = {};
  if (!show_name) fieldErrors.show_name = "Name the show.";
  const d = Object.fromEntries(SHOW_DATE_FIELDS.map((k) => [k, str(fd, k)])) as Record<(typeof SHOW_DATE_FIELDS)[number], string | null>;
  const backwards: Array<[keyof typeof d, keyof typeof d, string]> = [
    ["show_start_date", "show_end_date", "The show can't close before it opens."],
    ["move_in_start", "move_in_end", "Move-in can't end before it starts."],
    ["move_out_start", "move_out_end", "Move-out can't end before it starts."],
    ["advance_warehouse_open", "advance_warehouse_cutoff", "The deadline can't be before the warehouse opens."],
    ["direct_to_show_start", "direct_to_show_end", "Receiving can't end before it starts."],
  ];
  for (const [a, b, msg] of backwards) if (d[a] && d[b] && d[b]! < d[a]!) fieldErrors[b] = msg;
  const kit = str(fd, "exhibitor_manual_url");
  if (kit && !/^https?:\/\//i.test(kit)) fieldErrors.exhibitor_manual_url = "Paste the full link, starting with https://";
  const slug = (str(fd, "series_slug") ?? "").toLowerCase() || null;
  if (slug && !isValidSlug(slug)) fieldErrors.series_slug = "Lowercase letters, numbers and single hyphens, like sample-expo.";
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: current } = await supabase.from("shows").select("id, series_id, edition_year").eq("id", showId).maybeSingle();
  if (!current) return { error: "Show not found." };

  // 1. The show itself.
  const update = {
    show_name: show_name!,
    ...d,
    edition_year: current.edition_year ?? (d.show_start_date ? Number(d.show_start_date.slice(0, 4)) : null),
    venue_id: str(fd, "venue_id"),
    exhibitor_manual_url: kit,
    ...freight(fd, "advance_warehouse"),
    ...freight(fd, "direct_to_show"),
  } as TablesUpdate<"shows">;
  const { error: showErr } = await supabase.from("shows").update(update).eq("id", showId);
  if (showErr) return { error: showErr.message };

  // 2. Its web address. Created quietly and never published: a Shipping Center
  //    show needs the name for its URL, not a public SEO page.
  let seriesId = current.series_id;
  if (!seriesId && slug) {
    const { data: existing } = await supabase.from("show_series").select("id, name").eq("slug", slug).maybeSingle();
    if (existing) {
      if (fd.get("use_existing_series") == null) {
        return {
          error: `The web address "${slug}" already belongs to ${existing.name}.`,
          slugTaken: { name: existing.name },
          fieldErrors: { series_slug: "Taken." },
        };
      }
      seriesId = existing.id;
    } else {
      const { data: created, error: seriesErr } = await supabase
        .from("show_series")
        .insert({ name: evergreenName(show_name!), slug, is_public: false })
        .select("id")
        .single();
      if (seriesErr) return { error: seriesErr.message };
      seriesId = created.id;
    }
    const { error: linkErr } = await supabase.from("shows").update({ series_id: seriesId }).eq("id", showId);
    if (linkErr) {
      if (linkErr.code === "23505" || /one_live_edition_per_year/.test(linkErr.message))
        return { error: `${existing?.name ?? "That show"} already has an edition for this year. Pick a different web address.` };
      return { error: linkErr.message };
    }
  }

  // 3. The details only the public pages carry, and where they were checked.
  const logistics = {
    timezone: str(fd, "timezone"),
    advance_cutoff_local: str(fd, "advance_cutoff_local"),
    direct_cutoff_local: str(fd, "direct_cutoff_local"),
    label_requirements_note: str(fd, "label_requirements_note"),
    source_url: str(fd, "source_url") ?? kit,
    source_type: str(fd, "source_type") ?? "official_kit",
  };
  const { error: logErr } = await supabase
    .from("show_public_logistics")
    .upsert({ show_id: showId, ...logistics }, { onConflict: "show_id" });
  if (logErr) return { error: logErr.message };

  // 4. This GSC's settings for the show.
  const admin = await isAdmin(supabase);
  if (admin) {
    await supabase
      .from("ship_shows")
      .update({ coordinator_name: str(fd, "coordinator_name"), coordinator_mobile: str(fd, "coordinator_mobile") })
      .eq("partner_id", partnerId)
      .eq("show_id", showId);
  }

  if (!verify) {
    touch(partnerId, showId);
    return { error: null, ok: true, message: "Saved. Nothing changes for exhibitors until it's verified and on." };
  }

  // 5. Verify, with the same rules the database enforces.
  const { data: fresh } = await supabase
    .from("shows")
    .select(
      "show_start_date, show_end_date, advance_warehouse_name, advance_warehouse_street1, direct_to_show_street1, advance_warehouse_address, direct_to_show_address, series_id",
    )
    .eq("id", showId)
    .single();
  const blockers = fresh ? verifyBlockers(fresh, logistics).map((b) => b.message) : ["Show not found."];
  if (!fresh?.series_id) blockers.unshift("Give the show a web address (below the show name).");
  if (blockers.length) {
    touch(partnerId, showId);
    return { error: "Saved, but not ready to verify yet.", blockers };
  }

  const { data: claims } = await supabase.auth.getClaims();
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", claims?.claims?.sub ?? "")
    .maybeSingle();
  const verified_by = me?.full_name || me?.email || null;
  if (!verified_by) return { error: "Could not tell who you are. Sign in again and retry." };

  const { error: verErr } = await supabase
    .from("show_public_logistics")
    .update({ verification_status: "verified", last_verified_at: new Date().toISOString(), verified_by })
    .eq("show_id", showId);
  if (verErr) return { error: verErr.message };

  let turnedOn = false;
  if (admin) {
    const { error: onErr } = await supabase
      .from("ship_shows")
      .update({ enabled: true })
      .eq("partner_id", partnerId)
      .eq("show_id", showId);
    turnedOn = !onErr;
  }

  await logActivity(supabase, {
    action: "status_changed",
    entityType: "show_logistics",
    entityId: showId,
    summary: turnedOn ? "Verified and turned on in the Shipping Center" : "Verified for the Shipping Center",
    details: { source_url: logistics.source_url, verified_by, partner_id: partnerId },
  });
  nudgePublicSync();
  touch(partnerId, showId);
  return {
    error: null,
    ok: true,
    message: turnedOn ? "Verified and on." : "Verified. An admin turns it on.",
  };
}
