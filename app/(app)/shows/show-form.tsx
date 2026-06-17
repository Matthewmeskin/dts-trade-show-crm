"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import type { ShowFormState } from "./actions";
import type { Tables } from "@/lib/database.types";

type ShowRow = Tables<"shows">;
type VenueOpt = Pick<Tables<"venues">, "id" | "venue_name" | "city" | "state">;
type ContactOpt = Pick<
  Tables<"contacts">,
  "id" | "first_name" | "last_name" | "company"
>;

export function ShowForm({
  action,
  show,
  venues,
  contacts,
  submitLabel,
}: {
  action: (prev: ShowFormState, fd: FormData) => Promise<ShowFormState>;
  show?: ShowRow;
  venues: VenueOpt[];
  contacts: ContactOpt[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = show;

  return (
    <form action={formAction}>
      {show ? <input type="hidden" name="id" value={show.id} /> : null}

      <Card>
        <FormSection title="Show basics">
          <Field
            label="Show name"
            htmlFor="show_name"
            required
            error={err.show_name}
            className="sm:col-span-2"
          >
            <input
              id="show_name"
              name="show_name"
              defaultValue={d?.show_name ?? ""}
              className={inputClass}
              placeholder="e.g. TechWorld Expo"
            />
          </Field>

          <Field label="Edition year" htmlFor="edition_year">
            <input
              id="edition_year"
              name="edition_year"
              type="number"
              defaultValue={d?.edition_year ?? ""}
              className={inputClass}
              placeholder="2026"
            />
          </Field>

          <Field label="Industry vertical" htmlFor="industry_vertical">
            <input
              id="industry_vertical"
              name="industry_vertical"
              defaultValue={d?.industry_vertical ?? ""}
              className={inputClass}
              placeholder="Technology"
            />
          </Field>

          <Field label="Show management company" htmlFor="show_management_company">
            <input
              id="show_management_company"
              name="show_management_company"
              defaultValue={d?.show_management_company ?? ""}
              className={inputClass}
              placeholder="Freeman, GES, …"
            />
          </Field>

          <Field label="Venue" htmlFor="venue_id">
            <select
              id="venue_id"
              name="venue_id"
              defaultValue={d?.venue_id ?? ""}
              className={inputClass}
            >
              <option value="">— Select venue —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.venue_name}
                  {v.city ? ` (${v.city}${v.state ? `, ${v.state}` : ""})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Primary GSC contact"
            htmlFor="gsc_contact_id"
            hint="General service contractor relationship for this show."
          >
            <select
              id="gsc_contact_id"
              name="gsc_contact_id"
              defaultValue={d?.gsc_contact_id ?? ""}
              className={inputClass}
            >
              <option value="">— Select contact —</option>
              {contacts.map((c) => {
                const name =
                  [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                  "Unnamed contact";
                return (
                  <option key={c.id} value={c.id}>
                    {name}
                    {c.company ? ` · ${c.company}` : ""}
                  </option>
                );
              })}
            </select>
          </Field>
        </FormSection>

        <FormSection
          title="Show dates"
          description="The actual days the show is open — separate from the freight dates below."
        >
          <Field label="Show start date" htmlFor="show_start_date">
            <input id="show_start_date" name="show_start_date" type="date" defaultValue={d?.show_start_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Show end date" htmlFor="show_end_date" error={err.show_end_date}>
            <input id="show_end_date" name="show_end_date" type="date" defaultValue={d?.show_end_date ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Move-in / move-out"
          description="Freight logistics — the on-site dock window. Show status is computed from these."
        >
          <Field label="Move-in start" htmlFor="move_in_start">
            <input id="move_in_start" name="move_in_start" type="date" defaultValue={d?.move_in_start ?? ""} className={inputClass} />
          </Field>
          <Field label="Move-in end" htmlFor="move_in_end">
            <input id="move_in_end" name="move_in_end" type="date" defaultValue={d?.move_in_end ?? ""} className={inputClass} />
          </Field>
          <Field label="Move-out start" htmlFor="move_out_start">
            <input id="move_out_start" name="move_out_start" type="date" defaultValue={d?.move_out_start ?? ""} className={inputClass} />
          </Field>
          <Field label="Move-out end" htmlFor="move_out_end" error={err.move_out_end}>
            <input id="move_out_end" name="move_out_end" type="date" defaultValue={d?.move_out_end ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Freight windows"
          description="Advance warehouse and direct-to-show receiving."
        >
          <Field label="Advance warehouse open" htmlFor="advance_warehouse_open">
            <input id="advance_warehouse_open" name="advance_warehouse_open" type="date" defaultValue={d?.advance_warehouse_open ?? ""} className={inputClass} />
          </Field>
          <Field label="Advance warehouse cutoff" htmlFor="advance_warehouse_cutoff">
            <input id="advance_warehouse_cutoff" name="advance_warehouse_cutoff" type="date" defaultValue={d?.advance_warehouse_cutoff ?? ""} className={inputClass} />
          </Field>
          <Field label="Direct-to-show start" htmlFor="direct_to_show_start">
            <input id="direct_to_show_start" name="direct_to_show_start" type="date" defaultValue={d?.direct_to_show_start ?? ""} className={inputClass} />
          </Field>
          <Field label="Direct-to-show end" htmlFor="direct_to_show_end">
            <input id="direct_to_show_end" name="direct_to_show_end" type="date" defaultValue={d?.direct_to_show_end ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection title="Revenue">
          <Field label="Estimated revenue" htmlFor="estimated_revenue">
            <input id="estimated_revenue" name="estimated_revenue" inputMode="decimal" defaultValue={d?.estimated_revenue ?? ""} className={inputClass} placeholder="0.00" />
          </Field>
          <Field label="Actual revenue" htmlFor="actual_revenue">
            <input id="actual_revenue" name="actual_revenue" inputMode="decimal" defaultValue={d?.actual_revenue ?? ""} className={inputClass} placeholder="0.00" />
          </Field>
        </FormSection>

        <FormSection title="Notes">
          <Field label="Competitor notes" htmlFor="competitor_notes" className="sm:col-span-2">
            <textarea id="competitor_notes" name="competitor_notes" rows={3} defaultValue={d?.competitor_notes ?? ""} className={inputClass} />
          </Field>
          <Field label="General notes" htmlFor="general_notes" className="sm:col-span-2">
            <textarea id="general_notes" name="general_notes" rows={3} defaultValue={d?.general_notes ?? ""} className={inputClass} />
          </Field>
          <Field label="Archived" htmlFor="archived" hint="Overrides date-based status." className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input id="archived" name="archived" type="checkbox" defaultChecked={d?.archived ?? false} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
              Mark this show as archived
            </label>
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
          href={show ? `/shows/${show.id}` : "/shows"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
