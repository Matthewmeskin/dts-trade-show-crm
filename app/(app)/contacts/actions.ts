"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants, type TablesInsert } from "@/lib/database.types";

export type ContactFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function parseContact(fd: FormData): {
  data?: TablesInsert<"contacts">;
  fieldErrors?: Record<string, string>;
} {
  const first = str(fd, "first_name");
  const last = str(fd, "last_name");
  if (!first && !last) {
    return { fieldErrors: { first_name: "Enter at least a first or last name." } };
  }

  const type = str(fd, "contact_type");
  const contact_type =
    type && (Constants.public.Enums.contact_type as readonly string[]).includes(type)
      ? (type as TablesInsert<"contacts">["contact_type"])
      : null;

  return {
    data: {
      first_name: first,
      last_name: last,
      title: str(fd, "title"),
      company: str(fd, "company"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      contact_type,
      notes: str(fd, "notes"),
      show_id: str(fd, "show_id"),
      exhibitor_id: str(fd, "exhibitor_id"),
      venue_id: str(fd, "venue_id"),
      carrier_id: str(fd, "carrier_id"),
    },
  };
}

export async function createContact(
  _prev: ContactFormState,
  fd: FormData,
): Promise<ContactFormState> {
  const { data, fieldErrors } = parseContact(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("contacts")
    .insert(data!)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/contacts");
  const showId = String(fd.get("show_id") ?? "");
  if (showId) revalidatePath(`/shows/${showId}`);
  redirect(`/contacts/${row.id}?flash=created`);
}

export async function updateContact(
  _prev: ContactFormState,
  fd: FormData,
): Promise<ContactFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing contact id." };

  const { data, fieldErrors } = parseContact(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update(data!).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}?flash=updated`);
}

export async function deleteContact(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath("/contacts");
  redirect("/contacts?flash=deleted");
}
