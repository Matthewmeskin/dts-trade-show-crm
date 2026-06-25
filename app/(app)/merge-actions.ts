"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Merge a duplicate venue/show into the kept record: reassign all references,
 * fill the keeper's empty fields, delete the duplicate (via the merge_* SQL
 * functions). Redirects to the kept record.
 */
export async function mergeRecords(fd: FormData) {
  const kind = String(fd.get("kind") ?? "");
  const target = String(fd.get("target_id") ?? "");
  const source = String(fd.get("source_id") ?? "");
  if (!target || !source || target === source) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (kind === "venue") {
    await supabase.rpc("merge_venues", { p_target: target, p_source: source });
    revalidatePath("/venues");
    revalidatePath(`/venues/${target}`);
    redirect(`/venues/${target}?flash=merged`);
  } else if (kind === "show") {
    await supabase.rpc("merge_shows", { p_target: target, p_source: source });
    revalidatePath("/shows");
    revalidatePath(`/shows/${target}`);
    redirect(`/shows/${target}?flash=merged`);
  }
}
