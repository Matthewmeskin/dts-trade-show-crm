"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_TIER_OPTIONS } from "@/lib/exhibitors";
import type { Json, TablesInsert } from "@/lib/database.types";

export type ExhibitorFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Parse the secondary_contacts hidden JSON field into a clean array. */
function parseSecondary(fd: FormData): Json {
  const raw = String(fd.get("secondary_contacts") ?? "[]");
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((c) => ({
        name: String(c?.name ?? "").trim(),
        title: String(c?.title ?? "").trim(),
        email: String(c?.email ?? "").trim(),
        phone: String(c?.phone ?? "").trim(),
      }))
      .filter((c) => c.name || c.title || c.email || c.phone);
  } catch {
    return [];
  }
}

function parseExhibitor(fd: FormData): {
  data?: TablesInsert<"exhibitors">;
  fieldErrors?: Record<string, string>;
} {
  const company_name = str(fd, "company_name");
  if (!company_name) return { fieldErrors: { company_name: "Company name is required." } };

  const sales_status = str(fd, "sales_status");
  const priority_tier = str(fd, "priority_tier");

  return {
    data: {
      company_name,
      industry: str(fd, "industry"),
      website: str(fd, "website"),
      owner_rep: str(fd, "owner_rep"),
      sales_status,
      priority_tier,
      // Keep the human-readable tier label in sync when set from the form.
      priority_tier_label: priority_tier
        ? PRIORITY_TIER_OPTIONS.find((o) => o.value === priority_tier)?.label ?? priority_tier
        : null,
      primary_contact_name: str(fd, "primary_contact_name"),
      primary_contact_title: str(fd, "primary_contact_title"),
      primary_contact_email: str(fd, "primary_contact_email"),
      primary_contact_phone: str(fd, "primary_contact_phone"),
      secondary_contacts: parseSecondary(fd),
      freight_profile_notes: str(fd, "freight_profile_notes"),
      general_notes: str(fd, "general_notes"),
    },
  };
}

export async function createExhibitor(
  _prev: ExhibitorFormState,
  fd: FormData,
): Promise<ExhibitorFormState> {
  const { data, fieldErrors } = parseExhibitor(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("exhibitors")
    .insert(data!)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/exhibitors");
  redirect(`/exhibitors/${row.id}?flash=created`);
}

export async function updateExhibitor(
  _prev: ExhibitorFormState,
  fd: FormData,
): Promise<ExhibitorFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing exhibitor id." };

  const { data, fieldErrors } = parseExhibitor(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("exhibitors").update(data!).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/exhibitors");
  revalidatePath(`/exhibitors/${id}`);
  revalidatePath("/calendar");
  const back = String(fd.get("redirect_to") ?? "");
  redirect(back.startsWith("/") ? back : `/exhibitors/${id}?flash=updated`);
}

export type NotesState = { ok: boolean; error: string | null };

/** Inline-edit an exhibitor's general notes (e.g. why we are / aren't working with them). */
export async function updateExhibitorNotes(
  _prev: NotesState,
  fd: FormData,
): Promise<NotesState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing exhibitor id." };
  const general_notes = String(fd.get("general_notes") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("exhibitors").update({ general_notes }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/exhibitors/${id}`);
  return { ok: true, error: null };
}

export async function deleteExhibitor(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("exhibitors").delete().eq("id", id);
  revalidatePath("/exhibitors");
  redirect("/exhibitors?flash=deleted");
}
