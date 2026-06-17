"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import { Constants, type Tables } from "@/lib/database.types";
import { TASK_STATUS_META, TASK_PRIORITY_META } from "@/lib/tasks";
import type { TaskFormState } from "./actions";

type TaskRow = Tables<"tasks">;
type Opt = { id: string; label: string };

export type RelatedOptions = {
  shows: Opt[];
  exhibitors: Opt[];
  shipments: Opt[];
  carriers: Opt[];
  venues: Opt[];
};

export function TaskForm({
  action,
  task,
  profiles,
  related,
  defaults,
  submitLabel,
}: {
  action: (prev: TaskFormState, fd: FormData) => Promise<TaskFormState>;
  task?: TaskRow;
  profiles: Opt[];
  related: RelatedOptions;
  defaults?: Partial<Record<
    | "related_show_id"
    | "related_exhibitor_id"
    | "related_shipment_id"
    | "related_carrier_id"
    | "related_venue_id",
    string
  >>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = task;
  const rel = (key: keyof NonNullable<typeof defaults>) =>
    (d?.[key as keyof TaskRow] as string | null) ?? defaults?.[key] ?? "";

  const relatedSelects: { name: keyof RelatedOptions; key: keyof NonNullable<typeof defaults>; label: string }[] = [
    { name: "shows", key: "related_show_id", label: "Show" },
    { name: "exhibitors", key: "related_exhibitor_id", label: "Exhibitor" },
    { name: "shipments", key: "related_shipment_id", label: "Shipment" },
    { name: "carriers", key: "related_carrier_id", label: "Carrier" },
    { name: "venues", key: "related_venue_id", label: "Venue" },
  ];

  return (
    <form action={formAction}>
      {task ? <input type="hidden" name="id" value={task.id} /> : null}

      <Card>
        <FormSection title="Task">
          <Field label="Title" htmlFor="title" required error={err.title} className="sm:col-span-2">
            <input id="title" name="title" defaultValue={d?.title ?? ""} className={inputClass} placeholder="e.g. Confirm advance warehouse cutoff" />
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <textarea id="description" name="description" rows={3} defaultValue={d?.description ?? ""} className={inputClass} />
          </Field>
          <Field label="Assignee" htmlFor="assigned_to">
            <select id="assigned_to" name="assigned_to" defaultValue={d?.assigned_to ?? ""} className={inputClass}>
              <option value="">— Unassigned —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date" htmlFor="due_date">
            <input id="due_date" name="due_date" type="date" defaultValue={d?.due_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={d?.status ?? "open"} className={inputClass}>
              {Constants.public.Enums.task_status.map((s) => (
                <option key={s} value={s}>{TASK_STATUS_META[s].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <select id="priority" name="priority" defaultValue={d?.priority ?? "medium"} className={inputClass}>
              {Constants.public.Enums.task_priority.map((p) => (
                <option key={p} value={p}>{TASK_PRIORITY_META[p].label}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Related to" description="Link this task to any record (optional).">
          {relatedSelects.map((r) => (
            <Field key={r.key} label={r.label} htmlFor={r.key}>
              <select id={r.key} name={r.key} defaultValue={rel(r.key)} className={inputClass}>
                <option value="">— None —</option>
                {related[r.name].map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </Field>
          ))}
        </FormSection>
      </Card>

      {state.error ? (
        <p className="mt-4 rounded-lg bg-dts-maroon/5 px-3 py-2 text-sm text-dts-maroon">
          {state.error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link
          href={task ? `/tasks/${task.id}` : "/tasks"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
