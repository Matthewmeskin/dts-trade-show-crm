"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import type { ExhibitorFormState } from "./actions";
import type { Tables } from "@/lib/database.types";

type ExhibitorRow = Tables<"exhibitors">;
type Contact = { name: string; title: string; email: string; phone: string };

function toContacts(value: unknown): Contact[] {
  if (!Array.isArray(value)) return [];
  return value.map((c) => ({
    name: String((c as Contact)?.name ?? ""),
    title: String((c as Contact)?.title ?? ""),
    email: String((c as Contact)?.email ?? ""),
    phone: String((c as Contact)?.phone ?? ""),
  }));
}

export function ExhibitorForm({
  action,
  exhibitor,
  submitLabel,
}: {
  action: (prev: ExhibitorFormState, fd: FormData) => Promise<ExhibitorFormState>;
  exhibitor?: ExhibitorRow;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = exhibitor;

  const [contacts, setContacts] = useState<Contact[]>(
    toContacts(exhibitor?.secondary_contacts),
  );

  const update = (i: number, key: keyof Contact, val: string) =>
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  const addRow = () =>
    setContacts((prev) => [...prev, { name: "", title: "", email: "", phone: "" }]);
  const removeRow = (i: number) =>
    setContacts((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <form action={formAction}>
      {exhibitor ? <input type="hidden" name="id" value={exhibitor.id} /> : null}
      <input type="hidden" name="secondary_contacts" value={JSON.stringify(contacts)} />

      <Card>
        <FormSection title="Company">
          <Field label="Company name" htmlFor="company_name" required error={err.company_name} className="sm:col-span-2">
            <input id="company_name" name="company_name" defaultValue={d?.company_name ?? ""} className={inputClass} placeholder="e.g. Acme Robotics" />
          </Field>
          <Field label="Industry" htmlFor="industry">
            <input id="industry" name="industry" defaultValue={d?.industry ?? ""} className={inputClass} placeholder="Manufacturing" />
          </Field>
        </FormSection>

        <FormSection title="Primary contact">
          <Field label="Name" htmlFor="primary_contact_name">
            <input id="primary_contact_name" name="primary_contact_name" defaultValue={d?.primary_contact_name ?? ""} className={inputClass} />
          </Field>
          <Field label="Title" htmlFor="primary_contact_title">
            <input id="primary_contact_title" name="primary_contact_title" defaultValue={d?.primary_contact_title ?? ""} className={inputClass} />
          </Field>
          <Field label="Email" htmlFor="primary_contact_email">
            <input id="primary_contact_email" name="primary_contact_email" type="email" defaultValue={d?.primary_contact_email ?? ""} className={inputClass} />
          </Field>
          <Field label="Phone" htmlFor="primary_contact_phone">
            <input id="primary_contact_phone" name="primary_contact_phone" defaultValue={d?.primary_contact_phone ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        {/* Secondary contacts editor */}
        <section className="border-b border-slate-100 px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-slate-900">
              Secondary contacts
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-sm font-medium text-dts-maroon hover:underline"
            >
              <Icon name="plus" className="h-4 w-4" /> Add contact
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-400">No secondary contacts.</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <input value={c.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Name" className={inputClass} />
                  <input value={c.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Title" className={inputClass} />
                  <input value={c.email} onChange={(e) => update(i, "email", e.target.value)} placeholder="Email" className={inputClass} />
                  <input value={c.phone} onChange={(e) => update(i, "phone", e.target.value)} placeholder="Phone" className={inputClass} />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded-lg border border-slate-300 px-2 text-sm text-slate-400 hover:border-dts-maroon hover:text-dts-maroon"
                    aria-label="Remove contact"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <FormSection title="Notes">
          <Field label="Freight profile notes" htmlFor="freight_profile_notes" className="sm:col-span-2">
            <textarea id="freight_profile_notes" name="freight_profile_notes" rows={3} defaultValue={d?.freight_profile_notes ?? ""} className={inputClass} placeholder="Typical modes, dock preferences, recurring requirements…" />
          </Field>
          <Field label="General notes" htmlFor="general_notes" className="sm:col-span-2">
            <textarea id="general_notes" name="general_notes" rows={3} defaultValue={d?.general_notes ?? ""} className={inputClass} />
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
          href={exhibitor ? `/exhibitors/${exhibitor.id}` : "/exhibitors"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
