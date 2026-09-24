"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { isValidSlug, verifyBlockers } from "@/lib/logistics";

/**
 * Nudge the public-site sync (n8n "DTS Trade Show Public Sync") so a verify,
 * revert or publish is live in seconds instead of on the quarter hour. Fire
 * and forget after the response: the webhook carries no data, the sync reads
 * the export view itself, and the 15-minute schedule is the fallback if this
 * never arrives. Unset in an environment means no nudge, not an error.
 */
function nudgePublicSync() {
  const url = process.env.N8N_TRADE_SHOW_SYNC_WEBHOOK_URL;
  if (!url) return;
  after(async () => {
    try {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {
      /* the schedule covers it */
    }
  });
}

export type LogisticsState = {
  error: string | null;
  ok?: boolean;
  /** Blockers the database would have raised, reported before it had to. */
  blockers?: string[];
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const bool = (fd: FormData, k: string) => fd.get(k) != null;

/** The fields this tab owns. Everything else on the page lives on `shows`. */
function parseDraft(fd: FormData) {
  return {
    timezone: str(fd, "timezone"),
    advance_cutoff_local: str(fd, "advance_cutoff_local"),
    direct_cutoff_local: str(fd, "direct_cutoff_local"),
    carrier_check_in_cutoff_local: str(fd, "carrier_check_in_cutoff_local"),
    advance_late_surcharge_note: str(fd, "advance_late_surcharge_note"),
    targeted_move_in: bool(fd, "targeted_move_in"),
    targeted_move_in_note: str(fd, "targeted_move_in_note"),
    marshalling_yard_note: str(fd, "marshalling_yard_note"),
    label_requirements_note: str(fd, "label_requirements_note"),
    gsc_url: str(fd, "gsc_url"),
    dts_public_notes: str(fd, "dts_public_notes"),
    source_url: str(fd, "source_url"),
    source_type: str(fd, "source_type"),
  };
}

/** Who to credit on a verification, in the form a person would recognise. */
async function verifierName(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.full_name || profile?.email || user.email || null;
}

/**
 * Save without verifying. Deliberately permissive: a half-filled draft is how
 * research actually happens, and nothing draft is published.
 */
export async function saveLogistics(
  _prev: LogisticsState,
  fd: FormData,
): Promise<LogisticsState> {
  const show_id = String(fd.get("show_id") ?? "");
  if (!show_id) return { error: "Missing show id." };

  const supabase = await createClient();
  const draft = parseDraft(fd);
  const existingNotes = str(fd, "previous_notes");

  const { error } = await supabase.from("show_public_logistics").upsert(
    {
      show_id,
      ...draft,
      // Aged separately from the logistics facts, because the notes are the only
      // part of a show page a competitor cannot copy.
      dts_public_notes_updated_at:
        draft.dts_public_notes && draft.dts_public_notes !== existingNotes
          ? new Date().toISOString()
          : undefined,
    },
    { onConflict: "show_id" },
  );

  if (error) return { error: error.message };

  await logActivity(supabase, {
    action: "updated",
    entityType: "show_logistics",
    entityId: show_id,
    summary: "Saved public logistics draft",
  });
  revalidatePath(`/shows/${show_id}`);
  revalidatePath("/show-pages");
  return { error: null, ok: true };
}

/**
 * Save and verify. Records who checked it, when, and against what source.
 *
 * The blockers are checked here as well as in the form, because a Server Action
 * is a public endpoint - the form's checklist is a courtesy, not a gate. Beyond
 * both of those the database trigger still has the last word.
 */
export async function verifyLogistics(
  _prev: LogisticsState,
  fd: FormData,
): Promise<LogisticsState> {
  const show_id = String(fd.get("show_id") ?? "");
  if (!show_id) return { error: "Missing show id." };

  const supabase = await createClient();
  const draft = parseDraft(fd);

  const { data: show } = await supabase
    .from("shows")
    .select(
      "show_start_date, show_end_date, advance_warehouse_name, advance_warehouse_street1, direct_to_show_street1, advance_warehouse_address, direct_to_show_address, series_id",
    )
    .eq("id", show_id)
    .single();

  if (!show) return { error: "Show not found." };

  const blockers = verifyBlockers(show, draft);
  if (blockers.length) {
    return {
      error: "Not ready to verify yet.",
      blockers: blockers.map((b) => b.message),
    };
  }

  const verified_by = await verifierName(supabase);
  if (!verified_by) {
    return { error: "Could not tell who you are — sign in again and retry." };
  }

  const { error } = await supabase.from("show_public_logistics").upsert(
    {
      show_id,
      ...draft,
      verification_status: "verified",
      last_verified_at: new Date().toISOString(),
      verified_by,
    },
    { onConflict: "show_id" },
  );

  if (error) return { error: error.message };

  await logActivity(supabase, {
    action: "status_changed",
    entityType: "show_logistics",
    entityId: show_id,
    summary: `Verified public logistics against ${draft.source_type ?? "a source"}`,
    details: { source_url: draft.source_url, verified_by },
  });
  nudgePublicSync();
  revalidatePath(`/shows/${show_id}`);
  revalidatePath("/show-pages");
  return { error: null, ok: true };
}

/**
 * Push a verified row back to draft. The page comes down on the next sync, which
 * is the point: this is how you pull a page you no longer trust.
 */
export async function revertToDraft(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  if (!show_id) return;
  const supabase = await createClient();
  await supabase
    .from("show_public_logistics")
    .update({ verification_status: "draft" })
    .eq("show_id", show_id);
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "show_logistics",
    entityId: show_id,
    summary: "Pulled public logistics back to draft — the page comes down",
  });
  nudgePublicSync();
  revalidatePath(`/shows/${show_id}`);
  revalidatePath("/show-pages");
}

/**
 * Publish or unpublish the show. This is a property of the show, not of one
 * year: it controls whether the URL exists at all.
 */
export async function setSeriesPublic(fd: FormData) {
  const show_id = String(fd.get("show_id") ?? "");
  const series_id = String(fd.get("series_id") ?? "");
  const next = String(fd.get("is_public") ?? "") === "true";
  if (!series_id) return;

  const supabase = await createClient();
  const { data: series } = await supabase
    .from("show_series")
    .update({ is_public: next })
    .eq("id", series_id)
    .select("slug, name")
    .maybeSingle();

  await logActivity(supabase, {
    action: "status_changed",
    entityType: "show_series",
    entityId: series_id,
    entityLabel: series?.name ?? null,
    summary: next
      ? `Published /trade-show/shipping/${series?.slug ?? ""}`
      : `Unpublished /trade-show/shipping/${series?.slug ?? ""} — the page comes down`,
  });
  nudgePublicSync();
  if (show_id) revalidatePath(`/shows/${show_id}`);
  revalidatePath("/show-pages");
}

/** Attach this edition to a show that already exists. */
export async function assignSeries(
  _prev: LogisticsState,
  fd: FormData,
): Promise<LogisticsState> {
  const show_id = String(fd.get("show_id") ?? "");
  const series_id = String(fd.get("series_id") ?? "");
  if (!show_id) return { error: "Missing show id." };
  if (!series_id) return { error: "Pick a show to attach this year to." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shows")
    .update({ series_id })
    .eq("id", show_id);

  if (error) {
    // The one-live-edition-per-year index is the likely cause, and the raw
    // message will not mean anything to whoever is reading it.
    if (error.code === "23505" || /shows_one_live_edition_per_year/.test(error.message)) {
      return {
        error:
          "That show already has an edition for this year. Two live editions of one show cannot share a year — check whether the other one should be archived.",
      };
    }
    return { error: error.message };
  }

  await logActivity(supabase, {
    action: "updated",
    entityType: "show",
    entityId: show_id,
    summary: "Attached this edition to a show",
  });
  revalidatePath(`/shows/${show_id}`);
  revalidatePath("/show-pages");
  return { error: null, ok: true };
}

/**
 * Create the evergreen show from this edition, and attach it.
 *
 * The slug is typed by a person on purpose. It is the only value here that can
 * never be changed once the page has ranked — the public project refuses to
 * rename a slug that has ever been public — so it is not derived from a name
 * behind someone's back.
 */
export async function createSeries(
  _prev: LogisticsState,
  fd: FormData,
): Promise<LogisticsState> {
  const show_id = String(fd.get("show_id") ?? "");
  const name = str(fd, "series_name");
  const slug = str(fd, "series_slug");
  if (!show_id) return { error: "Missing show id." };
  if (!name) return { error: "The show needs a name." };
  if (!slug) return { error: "The show needs a URL slug." };
  if (!isValidSlug(slug)) {
    return {
      error:
        "A slug can only hold lowercase letters, numbers and single hyphens — for example ift-first.",
    };
  }

  const supabase = await createClient();
  const { data: series, error: insertError } = await supabase
    .from("show_series")
    .insert({
      name,
      slug,
      description_short: str(fd, "description_short"),
      industry: str(fd, "industry"),
      typical_city: str(fd, "typical_city"),
      typical_month: fd.get("typical_month")
        ? Number(fd.get("typical_month"))
        : null,
      is_public: false,
    })
    .select("id, slug")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: `The slug "${slug}" is already taken by another show.` };
    }
    return { error: insertError.message };
  }

  const { error: linkError } = await supabase
    .from("shows")
    .update({ series_id: series.id })
    .eq("id", show_id);
  if (linkError) return { error: linkError.message };

  await logActivity(supabase, {
    action: "created",
    entityType: "show_series",
    entityId: series.id,
    entityLabel: name,
    summary: `Created show ${name} at /trade-show/shipping/${series.slug}`,
  });
  revalidatePath(`/shows/${show_id}`);
  revalidatePath("/show-pages");
  return { error: null, ok: true };
}

/** Give a venue the URL slug its page links need. */
export async function setVenueSlug(
  _prev: LogisticsState,
  fd: FormData,
): Promise<LogisticsState> {
  const show_id = String(fd.get("show_id") ?? "");
  const venue_id = String(fd.get("venue_id") ?? "");
  const slug = str(fd, "venue_slug");
  if (!venue_id) return { error: "Missing venue." };
  if (!slug || !isValidSlug(slug)) {
    return {
      error:
        "A venue slug can only hold lowercase letters, numbers and single hyphens.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ public_slug: slug })
    .eq("id", venue_id);
  if (error) {
    if (error.code === "23505") {
      return { error: `The slug "${slug}" is already taken by another venue.` };
    }
    return { error: error.message };
  }

  await logActivity(supabase, {
    action: "updated",
    entityType: "venue",
    entityId: venue_id,
    summary: `Set the public slug to ${slug}`,
  });
  if (show_id) revalidatePath(`/shows/${show_id}`);
  return { error: null, ok: true };
}

/**
 * "Roll to next year" (spec §6): the next edition as a draft. Only the
 * evergreen facts come across — name, series, venue, organizer, GSC, industry,
 * website, sales owner. Dates, addresses, windows, kit URLs, revenue and notes
 * change every year, so they start empty; last year's are shown beside the form
 * for reference and never copied into live fields. If next year already exists
 * this simply opens it — two live editions of one show cannot share a year.
 */
export async function rollToNextYear(
  _prev: LogisticsState,
  fd: FormData,
): Promise<LogisticsState> {
  const show_id = String(fd.get("show_id") ?? "");
  if (!show_id) return { error: "Missing show id." };

  const supabase = await createClient();
  const { data: show } = await supabase
    .from("shows")
    .select(
      "id, show_name, edition_year, show_start_date, series_id, venue_id, show_management_company, decorator, gsc_contact_id, industry_vertical, website_url, sales_people, lead_gen_owner",
    )
    .eq("id", show_id)
    .single();
  if (!show) return { error: "Show not found." };
  if (!show.series_id) {
    return { error: "Attach this edition to a show first, so next year lands under the same page." };
  }

  const year =
    show.edition_year ??
    (show.show_start_date ? Number(show.show_start_date.slice(0, 4)) : null);
  if (!year) return { error: "This edition has no year yet — set its show dates or edition year first." };
  const nextYear = year + 1;

  const { data: existing } = await supabase
    .from("shows")
    .select("id")
    .eq("series_id", show.series_id)
    .eq("edition_year", nextYear)
    .eq("archived", false)
    .maybeSingle();
  if (existing) redirect(`/shows/${existing.id}?tab=logistics`);

  const { data: row, error } = await supabase
    .from("shows")
    .insert({
      show_name: show.show_name,
      edition_year: nextYear,
      series_id: show.series_id,
      venue_id: show.venue_id,
      show_management_company: show.show_management_company,
      decorator: show.decorator,
      gsc_contact_id: show.gsc_contact_id,
      industry_vertical: show.industry_vertical,
      website_url: show.website_url,
      sales_people: show.sales_people,
      lead_gen_owner: show.lead_gen_owner,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logActivity(supabase, {
    action: "created",
    entityType: "show",
    entityId: row.id,
    entityLabel: `${show.show_name} ${nextYear}`,
    summary: `Rolled ${show.show_name} ${year} to ${nextYear} as a draft`,
    details: { rolled_from: show_id },
  });
  revalidatePath("/shows");
  revalidatePath("/show-pages");
  revalidatePath(`/shows/${show_id}`);
  redirect(`/shows/${row.id}?tab=logistics&flash=rolled`);
}
