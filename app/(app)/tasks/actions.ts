"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity, diffPayload, TASK_FIELD_LABELS } from "@/lib/activity";
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

  await logActivity(supabase, {
    action: "created",
    entityType: "task",
    entityId: row.id,
    entityLabel: data!.title,
    summary: `Added task "${data!.title}"`,
  });

  revalidatePath("/tasks");
  revalidatePath("/activity");
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
  const { data: before } = await supabase
    .from("tasks")
    .select(Object.keys(data!).join(", "))
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("tasks").update(data!).eq("id", id);
  if (error) return { error: error.message };

  const { keys, summary } = diffPayload(
    before as Record<string, unknown> | null,
    data! as Record<string, unknown>,
    TASK_FIELD_LABELS,
  );
  if (keys.length) {
    await logActivity(supabase, {
      action: "updated",
      entityType: "task",
      entityId: id,
      entityLabel: data!.title,
      summary,
      details: { fields: keys },
    });
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/activity");
  redirect(`/tasks/${id}?flash=updated`);
}

export async function updateTaskStatus(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const status = enumOr(String(fd.get("status") ?? ""), Constants.public.Enums.task_status, "open");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").update({ status }).eq("id", id);
  const { data: task } = await supabase
    .from("tasks")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  await logActivity(supabase, {
    action: "status_changed",
    entityType: "task",
    entityId: id,
    entityLabel: task?.title ?? null,
    summary: `Set status to ${status}`,
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/activity");
  revalidatePath("/");
}

export async function deleteTask(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: doomed } = await supabase
    .from("tasks")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("tasks").delete().eq("id", id);
  await logActivity(supabase, {
    action: "deleted",
    entityType: "task",
    entityId: id,
    entityLabel: doomed?.title ?? null,
    summary: doomed?.title ? `Deleted task "${doomed.title}"` : "Deleted a task",
  });
  revalidatePath("/tasks");
  revalidatePath("/activity");
  redirect("/tasks?flash=deleted");
}
