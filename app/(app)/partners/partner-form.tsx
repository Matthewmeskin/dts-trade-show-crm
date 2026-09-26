"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import { PARTNER_TYPES, STAGES, TIERS, type Partner } from "@/lib/partners";
import type { PartnerState } from "./actions";

type Person = { id: string; name: string };

export function PartnerForm({
  action,
  partner,
  people,
  submitLabel,
}: {
  action: (prev: PartnerState, fd: FormData) => Promise<PartnerState>;
  partner?: Partner;
  people: Person[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = partner;

  return (
    <form action={formAction}>
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <Card>
        <FormSection title="Company">
          <Field label="Company name" htmlFor="name" required error={err.name} className="sm:col-span-2">
            <input id="name" name="name" defaultValue={d?.name ?? ""} className={inputClass} placeholder="e.g. Pacific Exhibits" />
          </Field>
          <Field
            label="Partner type"
            htmlFor="partner_type"
            required
            error={err.partner_type}
            hint="Builders first — they already make the shipping call for their clients."
          >
            <select id="partner_type" name="partner_type" defaultValue={d?.partner_type ?? "exhibit_house"} className={inputClass}>
              {PARTNER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tier" htmlFor="tier" error={err.tier} hint="Tier 1 = most shows and clients, work first.">
            <select id="tier" name="tier" defaultValue={d?.tier ?? ""} className={inputClass}>
              <option value="">Untiered</option>
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Website" htmlFor="website" error={err.website}>
            <input id="website" name="website" defaultValue={d?.website ?? ""} className={inputClass} placeholder="example.com" />
          </Field>
          <Field
            label="Exhibitor clients"
            htmlFor="client_count"
            hint="How many exhibitors they influence freight for. 3+ qualifies (GSCs and organizers always do)."
          >
            <input id="client_count" name="client_count" inputMode="numeric" defaultValue={d?.client_count ?? ""} className={inputClass} />
          </Field>
          <Field label="City" htmlFor="city">
            <input id="city" name="city" defaultValue={d?.city ?? ""} className={inputClass} />
          </Field>
          <Field label="State" htmlFor="state">
            <input id="state" name="state" defaultValue={d?.state ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection title="Working it">
          <Field label="Status" htmlFor="stage" error={err.stage}>
            <select id="stage" name="stage" defaultValue={d?.stage ?? "target"} className={inputClass}>
              {STAGES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source" htmlFor="source" hint="Where this name came from (EDPA list, Apollo, referral…).">
            <input id="source" name="source" defaultValue={d?.source ?? ""} className={inputClass} />
          </Field>
          <Field label="Sales admin" htmlFor="admin_id">
            <select id="admin_id" name="admin_id" defaultValue={d?.admin_id ?? ""} className={inputClass}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rep" htmlFor="rep_id">
            <select id="rep_id" name="rep_id" defaultValue={d?.rep_id ?? ""} className={inputClass}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Next step" htmlFor="next_step">
            <input id="next_step" name="next_step" defaultValue={d?.next_step ?? ""} className={inputClass} />
          </Field>
          <Field label="Next step date" htmlFor="next_step_on">
            <input id="next_step_on" name="next_step_on" type="date" defaultValue={d?.next_step_on ?? ""} className={inputClass} />
          </Field>
          <Field label="Current shipping pain" htmlFor="shipping_pain" className="sm:col-span-2" hint="In their words.">
            <textarea id="shipping_pain" name="shipping_pain" rows={2} defaultValue={d?.shipping_pain ?? ""} className={inputClass} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <textarea id="notes" name="notes" rows={3} defaultValue={d?.notes ?? ""} className={inputClass} />
          </Field>
        </FormSection>
      </Card>

      {state.error ? <p className="mt-4 rounded-lg bg-dts-maroon/5 px-3 py-2 text-sm text-dts-maroon">{state.error}</p> : null}
      <div className="mt-5 flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link href={d ? `/partners/${d.id}` : "/partners"} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Cancel
        </Link>
      </div>
    </form>
  );
}
