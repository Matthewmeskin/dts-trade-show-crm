/**
 * Resolves who an MHA uploader should contact at DTS.
 *
 * Priority: the show's assigned team (with a phone or email) → any user flagged
 * as the default MHA contact → a hard fallback. The show is found from the
 * matched load first, then a best-effort match on the transcribed show name.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type MhaContact = {
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
};

/** Last-resort contact when no assignee and no default user is configured. */
export const FALLBACK_MHA_CONTACT: MhaContact = {
  name: "Diversified Transportation Services",
  title: "Move-out support",
  phone: null,
  email: null,
};

type ProfileContact = {
  full_name: string | null;
  email: string | null;
  title: string | null;
  phone: string | null;
};

function toContact(u: ProfileContact): MhaContact {
  return {
    name: u.full_name?.trim() || u.email || "DTS",
    title: u.title,
    phone: u.phone,
    email: u.email,
  };
}

const reachable = (c: MhaContact) => !!(c.phone || c.email);

/** Find the show for this MHA: matched load first, then transcribed name. */
export async function resolveShowId(
  supabase: SupabaseClient<Database>,
  loadId: string | null,
  showName: string | null,
): Promise<string | null> {
  if (loadId) {
    const { data } = await supabase
      .from("shipments")
      .select("show_id")
      .eq("id", loadId)
      .maybeSingle();
    if (data?.show_id) return data.show_id;
  }
  const name = showName?.trim();
  if (name && name.length >= 4) {
    const { data } = await supabase
      .from("shows")
      .select("id")
      .ilike("show_name", `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

export type ResolvedContacts = { contacts: MhaContact[]; isDefault: boolean };

/** The team to show for a resolved show, falling back to the default contact. */
export async function getMhaContacts(
  supabase: SupabaseClient<Database>,
  showId: string | null,
): Promise<ResolvedContacts> {
  if (showId) {
    const { data } = await supabase
      .from("show_assignees")
      .select("user:profiles(full_name, email, title, phone)")
      .eq("show_id", showId);
    const assigned = (data ?? [])
      .map((r) => (r.user ? toContact(r.user) : null))
      .filter((c): c is MhaContact => c != null && reachable(c));
    if (assigned.length) return { contacts: assigned, isDefault: false };
  }

  const { data: defs } = await supabase
    .from("profiles")
    .select("full_name, email, title, phone")
    .eq("is_mha_default_contact", true);
  const defaults = (defs ?? []).map(toContact).filter(reachable);
  if (defaults.length) return { contacts: defaults, isDefault: true };

  return { contacts: [FALLBACK_MHA_CONTACT], isDefault: true };
}
