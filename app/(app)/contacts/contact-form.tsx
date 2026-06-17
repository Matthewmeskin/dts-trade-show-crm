"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import { Constants, type Tables } from "@/lib/database.types";
import { CONTACT_TYPE_META } from "@/lib/contacts";
import type { ContactFormState } from "./actions";

type ContactRow = Tables<"contacts">;
type Opt = { id: string; label: string };

export type ContactOptions = {
  shows: Opt[];
  exhibitors: Opt[];
  venues: Opt[];
  carriers: Opt[];
};

export function ContactForm({
  action,
  contact,
  options,
  defaults,
  submitLabel,
}: {
  action: (prev: ContactFormState, fd: FormData) => Promise<ContactFormState>;
  contact?: ContactRow;
  options: ContactOptions;
  defaults?: Partial<Record<"show_id" | "exhibitor_id" | "venue_id" | "carrier_id", string>>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = contact;
  const attach = (key: "show_id" | "exhibitor_id" | "venue_id" | "carrier_id") =>
    (d?.[key] as string | null) ?? defaults?.[key] ?? "";

  const attachments: { name: keyof ContactOptions; key: "show_id" | "exhibitor_id" | "venue_id" | "carrier_id"; label: string }[] = [
    { name: "shows", key: "show_id", label: "Show" },
    { name: "exhibitors", key: "exhibitor_id", label: "Exhibitor" },
    { name: "venues", key: "venue_id", label: "Venue" },
    { name: "carriers", key: "carrier_id", label: "Carrier" },
  ];

  return (
    <form action={formAction}>
      {contact ? <input type="hidden" name="id" value={contact.id} /> : null}

      <Card>
        <FormSection title="Contact">
          <Field label="First name" htmlFor="first_name" error={err.first_name}>
            <input id="first_name" name="first_name" defaultValue={d?.first_name ?? ""} className={inputClass} />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <input id="last_name" name="last_name" defaultValue={d?.last_name ?? ""} className={inputClass} />
          </Field>
          <Field label="Title" htmlFor="title">
            <input id="title" name="title" defaultValue={d?.title ?? ""} className={inputClass} />
          </Field>
          <Field label="Company" htmlFor="company">
            <input id="company" name="company" defaultValue={d?.company ?? ""} className={inputClass} />
          </Field>
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" defaultValue={d?.email ?? ""} className={inputClass} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input id="phone" name="phone" defaultValue={d?.phone ?? ""} className={inputClass} />
          </Field>
          <Field label="Contact type" htmlFor="contact_type">
            <select id="contact_type" name="contact_type" defaultValue={d?.contact_type ?? ""} className={inputClass}>
              <option value="">— Select type —</option>
              {Constants.public.Enums.contact_type.map((t) => (
                <option key={t} value={t}>{CONTACT_TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Attached to" description="Link this contact to any record (optional).">
          {attachments.map((a) => (
            <Field key={a.key} label={a.label} htmlFor={a.key}>
              <select id={a.key} name={a.key} defaultValue={attach(a.key)} className={inputClass}>
                <option value="">— None —</option>
                {options[a.name].map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </Field>
          ))}
        </FormSection>

        <FormSection title="Notes">
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <textarea id="notes" name="notes" rows={4} defaultValue={d?.notes ?? ""} className={inputClass} />
          </Field>
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
          href={contact ? `/contacts/${contact.id}` : "/contacts"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
