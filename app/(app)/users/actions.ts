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
export async function createUser(
  _prev: UserFormState,
  fd: FormData,
): Promise<UserFormState> {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };

  const email = str(fd, "email").toLowerCase();
  const full_name = str(fd, "full_name");
  const password = String(fd.get("password") ?? "");
  const role = (str(fd, "role") === "admin" ? "admin" : "standard") as Role;

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "Enter a valid email.";
  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (Object.keys(fieldErrors).length) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const admin = createAdminClient();
  // email_confirm:true so they can sign in immediately (internal users, no
  // public sign-up). The on_auth_user_created trigger creates the profile row,
  // pulling full_name from user_metadata.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    const msg = /already.*registered|exists/i.test(error.message)
      ? "A user with that email already exists."
      : error.message;
    return { error: msg, fieldErrors: { email: msg } };
  }

  if (role === "admin" && data.user) {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) return { error: `User created, but setting admin role failed: ${roleError.message}` };
  }

  revalidatePath("/users");
  redirect("/users?flash=user-created");
}

/** Change a user's role (admin ⇄ standard). Admin only. */
export async function setUserRole(fd: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return;

  const id = str(fd, "id");
  const role = (str(fd, "role") === "admin" ? "admin" : "standard") as Role;
  if (!id) return;
  // Don't let an admin strip their own admin rights (and risk locking everyone
  // out of user management).
  if (id === gate.uid && role !== "admin") return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/users");
}

/** Permanently remove a user. Admin only; can't delete yourself. */
export async function deleteUser(fd: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return;

  const id = str(fd, "id");
  if (!id || id === gate.uid) return;

  const admin = createAdminClient();
  // Deleting the auth user cascades to the profile row (FK on delete cascade).
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/users");
  redirect("/users?flash=user-removed");
}
