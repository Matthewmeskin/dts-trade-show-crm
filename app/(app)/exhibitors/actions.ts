"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return {
    data: {
      company_name,
      industry: str(fd, "industry"),
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
  redirect(`/exhibitors/${row.id}`);
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
  redirect(`/exhibitors/${id}`);
}

export async function deleteExhibitor(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("exhibitors").delete().eq("id", id);
  revalidatePath("/exhibitors");
  redirect("/exhibitors");
}
