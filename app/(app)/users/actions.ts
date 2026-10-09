"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/database.types";

type Role = Enums<"user_role">;

export type UserFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

/**
 * Confirm the caller is a signed-in admin before any user-management action.
 * Returns the caller's id so actions can guard against self-targeting. These
 * actions use the service-role client (which bypasses RLS), so this gate is the
 * only thing standing between a standard user and creating/deleting accounts.
 */
async function requireAdmin(): Promise<{ uid: string } | { error: string }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  if (profile?.role !== "admin") return { error: "Only admins can manage users." };
  return { uid };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Invite/create an internal user with email + password. Admin only. */
// createUser: access and roles are set on the DTS portal's Users page for every
// portal at once (dts-sage/web, app/(app)/users). Kept so nothing that imports
// it breaks; it refuses.
export async function createUser(
  _prev: UserFormState,
  fd: FormData,
): Promise<UserFormState> {
  throw new Error("User access is managed on the DTS portal's Users page.");
}

/** Save a user's contact details, booking link + default-MHA-contact flag. Admin only. */
export async function setUserContact(fd: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return;

  const id = str(fd, "id");
  if (!id) return;
  const phone = str(fd, "phone") || null;
  const title = str(fd, "title") || null;
  const is_mha_default_contact = fd.get("is_mha_default_contact") != null;
  // The rep's booking link: the sales admin books partner calls straight onto it.
  const rawBooking = str(fd, "booking_url");
  const booking_url = rawBooking && /^https?:\/\//i.test(rawBooking) ? rawBooking : null;

  // Admin update runs through the caller's session so the profiles RLS
  // "admin update any" policy applies (the role-change trigger is untouched).
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ phone, title, is_mha_default_contact, booking_url })
    .eq("id", id);
  revalidatePath("/users");
}

/** Change a user's role (admin ⇄ standard). Admin only. */
// setUserRole: access and roles are set on the DTS portal's Users page for every
// portal at once (dts-sage/web, app/(app)/users). Kept so nothing that imports
// it breaks; it refuses.
export async function setUserRole(fd: FormData) {
  throw new Error("User access is managed on the DTS portal's Users page.");
}

/** Permanently remove a user. Admin only; can't delete yourself. */
// deleteUser: access and roles are set on the DTS portal's Users page for every
// portal at once (dts-sage/web, app/(app)/users). Kept so nothing that imports
// it breaks; it refuses.
export async function deleteUser(fd: FormData) {
  throw new Error("User access is managed on the DTS portal's Users page.");
}
