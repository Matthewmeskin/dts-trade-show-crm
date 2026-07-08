"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/lib/database.types";
import { DOCUMENTS_BUCKET } from "@/lib/documents";

export type DocumentState = { error: string | null };

/**
 * Insert a document row after the file has already been uploaded to the
 * `documents` storage bucket (the upload happens client-side, direct to
 * Storage, so we never push the file bytes through a Server Action).
 */
export async function createDocument(fd: FormData): Promise<DocumentState> {
  const show_id = String(fd.get("show_id") ?? "").trim();
  const document_name = String(fd.get("document_name") ?? "").trim();
  const file_url = String(fd.get("file_url") ?? "").trim();
  const typeRaw = String(fd.get("document_type") ?? "").trim();
  const document_type =
    typeRaw && (Constants.public.Enums.document_type as readonly string[]).includes(typeRaw)
      ? (typeRaw as (typeof Constants.public.Enums.document_type)[number])
      : null;

  if (!show_id) return { error: "A show is required." };
  if (!document_name) return { error: "A document name is required." };
  if (!file_url) return { error: "Upload a file first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("documents").insert({
    show_id,
    document_name,
    document_type,
    file_url,
    uploaded_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/documents");
  revalidatePath(`/shows/${show_id}`);
  return { error: null };
}

/** Create a short-lived signed URL and redirect the browser to download it. */
export async function documentDownload(fd: FormData) {
  const path = String(fd.get("path") ?? "");
  if (!path) return;
  // MHA files live in their own private bucket; everything else in `documents`.
  const bucket = String(fd.get("bucket") ?? "") || DOCUMENTS_BUCKET;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60, { download: true });
  if (data?.signedUrl) redirect(data.signedUrl);
}

export async function deleteDocument(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const path = String(fd.get("path") ?? "");
  const show_id = String(fd.get("show_id") ?? "");
  const bucket = String(fd.get("bucket") ?? "") || DOCUMENTS_BUCKET;
  if (!id) return;

  const supabase = await createClient();
  if (path) await supabase.storage.from(bucket).remove([path]);
  await supabase.from("documents").delete().eq("id", id);

  revalidatePath("/documents");
  if (show_id) revalidatePath(`/shows/${show_id}`);
}
