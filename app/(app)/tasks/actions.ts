"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Constants, type TablesInsert } from "@/lib/database.types";

export type TaskFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
function enumOr<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function parseTask(fd: FormData): {
  data?: Omit<TablesInsert<"tasks">, "created_by">;
  fieldErrors?: Record<string, string>;
} {
  const title = str(fd, "title");
  if (!title) return { fieldErrors: { title: "Title is required." } };

  return {
    data: {
      title,
      description: str(fd, "description"),
      due_date: str(fd, "due_date"),
      assigned_to: str(fd, "assigned_to"),
      status: enumOr(str(fd, "status"), Constants.public.Enums.task_status, "open"),
      priority: enumOr(str(fd, "priority"), Constants.public.Enums.task_priority, "medium"),
      related_show_id: str(fd, "related_show_id"),
      related_exhibitor_id: str(fd, "related_exhibitor_id"),
      related_shipment_id: str(fd, "related_shipment_id"),
      related_carrier_id: str(fd, "related_carrier_id"),
      related_venue_id: str(fd, "related_venue_id"),
    },
  };
}

export async function createTask(
  _prev: TaskFormState,
  fd: FormData,
): Promise<TaskFormState> {
  const { data, fieldErrors } = parseTask(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("tasks")
    .insert({ ...data!, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  redirect(`/tasks/${row.id}?flash=created`);
}

export async function updateTask(
  _prev: TaskFormState,
  fd: FormData,
): Promise<TaskFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing task id." };

  const { data, fieldErrors } = parseTask(fd);
  if (fieldErrors) return { error: "Please fix the highlighted fields.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(data!).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  redirect(`/tasks/${id}?flash=updated`);
}

export async function updateTaskStatus(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const status = enumOr(String(fd.get("status") ?? ""), Constants.public.Enums.task_status, "open");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").update({ status }).eq("id", id);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/");
}

export async function deleteTask(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
  redirect("/tasks?flash=deleted");
}
