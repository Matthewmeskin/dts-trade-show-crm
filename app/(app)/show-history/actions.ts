"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Turn a Show History entry into a real show record: create (or reuse) a 2026
 * `shows` row for the name and link its 2026-roster exhibitors (falling back to
 * historical shippers) as show_exhibitors, so the show flows into the Shows
 * section, calendar, and sales pipeline. Redirects to the show.
 */
export async function createShowFromHistory(formData: FormData) {
  const show = String(formData.get("show") ?? "").trim();
  if (!show) return;

  const supabase = await createClient();

  // Find or create the 2026 show record. Real show names are descriptive
  // ("IMTS ( International Manufacturing Technology Show)"), so match an existing
  // 2026 show whose name contains the canonical key (alphanumerics only).
  const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = alnum(show);
  const { data: shows2026 } = await supabase.from("shows").select("id, show_name").eq("edition_year", 2026);
  let showId =
    key.length >= 4
      ? (shows2026 ?? []).find((s) => alnum(s.show_name ?? "").includes(key))?.id
      : undefined;
  if (!showId) {
    const { data: ins, error } = await supabase
      .from("shows")
      .insert({ show_name: show, edition_year: 2026 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    showId = ins.id;
  }

  // Exhibitors to attach: the 2026 roster, else the historical shippers.
  const { data: roster } = await supabase
    .from("exhibitor_show_roster")
    .select("exhibitor_id")
    .eq("show_name", show)
    .eq("year", 2026);
  let ids = (roster ?? []).map((r) => r.exhibitor_id);
  if (ids.length === 0) {
    const { data: hist } = await supabase
      .from("exhibitor_show_history")
      .select("exhibitor_id")
      .eq("canonical_show_name", show);
    ids = [...new Set((hist ?? []).map((h) => h.exhibitor_id))];
  }

  if (ids.length > 0) {
    const { data: linked } = await supabase
      .from("show_exhibitors")
      .select("exhibitor_id")
      .eq("show_id", showId);
    const have = new Set((linked ?? []).map((l) => l.exhibitor_id));
    const rows = ids.filter((id) => !have.has(id)).map((exhibitor_id) => ({ show_id: showId!, exhibitor_id }));
    if (rows.length > 0) {
      const { error } = await supabase.from("show_exhibitors").insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/shows");
  revalidatePath(`/show-history`);
  redirect(`/shows/${showId}`);
}
