"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import type { ShowFormState } from "./actions";
import type { Tables } from "@/lib/database.types";
import type { FreightAddressParts } from "@/lib/freight";

/**
 * The structured parts of a freight delivery address. Field names are prefixed
 * (advance_warehouse_* / direct_to_show_*) so they map straight onto the show
 * columns; the parse step composes them back into the legacy *_address line.
 */
function FreightAddressFields({
  prefix,
  values,
}: {
  prefix: "advance_warehouse" | "direct_to_show" | "marshalling_yard";
  values: FreightAddressParts;
}) {
  const f = (k: string) => `${prefix}_${k}`;
  return (
    <>
      <Field label="Ship to / recipient" htmlFor={f("name")} className="sm:col-span-2">
        <input id={f("name")} name={f("name")} defaultValue={values.name ?? ""} className={inputClass} placeholder="Exhibiting company / booth #" />
      </Field>
      <Field label="C/O (handling agent)" htmlFor={f("care_of")} className="sm:col-span-2">
        <input id={f("care_of")} name={f("care_of")} defaultValue={values.care_of ?? ""} className={inputClass} placeholder="e.g. C/O Freeman" />
      </Field>
      <Field label="Street address" htmlFor={f("street1")} className="sm:col-span-2">
        <input id={f("street1")} name={f("street1")} defaultValue={values.street1 ?? ""} className={inputClass} placeholder="Street" />
      </Field>
      <Field label="Suite / line 2" htmlFor={f("street2")} className="sm:col-span-2">
        <input id={f("street2")} name={f("street2")} defaultValue={values.street2 ?? ""} className={inputClass} placeholder="Suite, unit, dock…" />
      </Field>
      <Field label="City" htmlFor={f("city")}>
        <input id={f("city")} name={f("city")} defaultValue={values.city ?? ""} className={inputClass} />
      </Field>
      <Field label="State" htmlFor={f("state")}>
        <input id={f("state")} name={f("state")} defaultValue={values.state ?? ""} className={inputClass} />
      </Field>
      <Field label="ZIP" htmlFor={f("zip")}>
        <input id={f("zip")} name={f("zip")} defaultValue={values.zip ?? ""} className={inputClass} />
      </Field>
      <Field label="Country" htmlFor={f("country")}>
        <input id={f("country")} name={f("country")} defaultValue={values.country ?? ""} className={inputClass} placeholder="USA" />
      </Field>
    </>
  );
}

type ShowRow = Tables<"shows">;
type VenueOpt = Pick<Tables<"venues">, "id" | "venue_name" | "city" | "state">;
type ContactOpt = Pick<
  Tables<"contacts">,
  "id" | "first_name" | "last_name" | "company"
>;

export function ShowForm({
  action,
  show,
  defaults,
  venues,
  contacts,
  submitLabel,
  redirectTo,
}: {
  action: (prev: ShowFormState, fd: FormData) => Promise<ShowFormState>;
  show?: ShowRow;
  defaults?: Partial<ShowRow>;
  venues: VenueOpt[];
  contacts: ContactOpt[];
  submitLabel: string;
  redirectTo?: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = show ?? defaults;

  return (
    <form action={formAction}>
      {show ? <input type="hidden" name="id" value={show.id} /> : null}
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}

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
          title="Links"
          description="Show website and exhibitor resources."
        >
          <Field label="Show website" htmlFor="website_url" className="sm:col-span-2">
            <input id="website_url" name="website_url" type="url" inputMode="url" defaultValue={d?.website_url ?? ""} className={inputClass} placeholder="https://…" />
          </Field>
          <Field label="Exhibitor manual link" htmlFor="exhibitor_manual_url" className="sm:col-span-2">
            <input id="exhibitor_manual_url" name="exhibitor_manual_url" type="url" inputMode="url" defaultValue={d?.exhibitor_manual_url ?? ""} className={inputClass} placeholder="https://…" />
          </Field>
          <Field label="Exhibitor list link" htmlFor="exhibitor_list_url" className="sm:col-span-2">
            <input id="exhibitor_list_url" name="exhibitor_list_url" type="url" inputMode="url" defaultValue={d?.exhibitor_list_url ?? ""} className={inputClass} placeholder="https://…" />
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

        {/* Preserve any pre-existing single-line address when the structured
            parts are left empty (the parse step composes parts → *_address). */}
        <input type="hidden" name="advance_warehouse_address_legacy" value={d?.advance_warehouse_address ?? ""} />
        <input type="hidden" name="direct_to_show_address_legacy" value={d?.direct_to_show_address ?? ""} />
        <input type="hidden" name="marshalling_yard_address_legacy" value={d?.marshalling_yard_address ?? ""} />

        <FormSection
          title="Advance warehouse"
          description="Receiving dock / advance warehouse — shipping label and date window."
        >
          <FreightAddressFields
            prefix="advance_warehouse"
            values={{
              name: d?.advance_warehouse_name,
              care_of: d?.advance_warehouse_care_of,
              street1: d?.advance_warehouse_street1,
              street2: d?.advance_warehouse_street2,
              city: d?.advance_warehouse_city,
              state: d?.advance_warehouse_state,
              zip: d?.advance_warehouse_zip,
              country: d?.advance_warehouse_country,
            }}
          />
          <Field label="Advance warehouse open" htmlFor="advance_warehouse_open">
            <input id="advance_warehouse_open" name="advance_warehouse_open" type="date" defaultValue={d?.advance_warehouse_open ?? ""} className={inputClass} />
          </Field>
          <Field label="Advance warehouse cutoff" htmlFor="advance_warehouse_cutoff">
            <input id="advance_warehouse_cutoff" name="advance_warehouse_cutoff" type="date" defaultValue={d?.advance_warehouse_cutoff ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Direct to show"
          description="Show-site / venue dock — shipping label and date window."
        >
          <FreightAddressFields
            prefix="direct_to_show"
            values={{
              name: d?.direct_to_show_name,
              care_of: d?.direct_to_show_care_of,
              street1: d?.direct_to_show_street1,
              street2: d?.direct_to_show_street2,
              city: d?.direct_to_show_city,
              state: d?.direct_to_show_state,
              zip: d?.direct_to_show_zip,
              country: d?.direct_to_show_country,
            }}
          />
          <Field label="Direct-to-show start" htmlFor="direct_to_show_start">
            <input id="direct_to_show_start" name="direct_to_show_start" type="date" defaultValue={d?.direct_to_show_start ?? ""} className={inputClass} />
          </Field>
          <Field label="Direct-to-show end" htmlFor="direct_to_show_end">
            <input id="direct_to_show_end" name="direct_to_show_end" type="date" defaultValue={d?.direct_to_show_end ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Marshalling yard"
          description="Staging / marshalling yard — shipping label and date window."
        >
          <FreightAddressFields
            prefix="marshalling_yard"
            values={{
              name: d?.marshalling_yard_name,
              care_of: d?.marshalling_yard_care_of,
              street1: d?.marshalling_yard_street1,
              street2: d?.marshalling_yard_street2,
              city: d?.marshalling_yard_city,
              state: d?.marshalling_yard_state,
              zip: d?.marshalling_yard_zip,
              country: d?.marshalling_yard_country,
            }}
          />
          <Field label="Marshalling yard open" htmlFor="marshalling_yard_open">
            <input id="marshalling_yard_open" name="marshalling_yard_open" type="date" defaultValue={d?.marshalling_yard_open ?? ""} className={inputClass} />
          </Field>
          <Field label="Marshalling yard cutoff" htmlFor="marshalling_yard_cutoff">
            <input id="marshalling_yard_cutoff" name="marshalling_yard_cutoff" type="date" defaultValue={d?.marshalling_yard_cutoff ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Sales & lead gen"
          description="Sales pipeline tracking. Start-call (−60d), email-team (−14d) and week-before (−7d) dates are computed from the show start date."
        >
          <Field label="# of exhibitors" htmlFor="exhibitor_count" hint="Decorator is the “Show management company” above; ship windows are the Advance-warehouse and Direct-to-show dates below.">
            <input id="exhibitor_count" name="exhibitor_count" type="number" defaultValue={d?.exhibitor_count ?? ""} className={inputClass} placeholder="e.g. 435" />
          </Field>
          <Field label="Sales people" htmlFor="sales_people">
            <input id="sales_people" name="sales_people" defaultValue={d?.sales_people ?? ""} className={inputClass} placeholder="e.g. Jean and Jas" />
          </Field>
          <Field label="Lead gen owner" htmlFor="lead_gen_owner">
            <input id="lead_gen_owner" name="lead_gen_owner" defaultValue={d?.lead_gen_owner ?? ""} className={inputClass} placeholder="e.g. Anie" />
          </Field>
          <Field label="Lead gen start" htmlFor="lead_gen_start_date">
            <input id="lead_gen_start_date" name="lead_gen_start_date" type="date" defaultValue={d?.lead_gen_start_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Lead gen completion" htmlFor="lead_gen_completion_date">
            <input id="lead_gen_completion_date" name="lead_gen_completion_date" type="date" defaultValue={d?.lead_gen_completion_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Move-in schedule link" htmlFor="move_in_schedule_url" className="sm:col-span-2">
            <input id="move_in_schedule_url" name="move_in_schedule_url" type="url" inputMode="url" defaultValue={d?.move_in_schedule_url ?? ""} className={inputClass} placeholder="https://…" />
          </Field>
          <Field label="Team emailed (2 weeks out)" htmlFor="emailed_two_weeks" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input id="emailed_two_weeks" name="emailed_two_weeks" type="checkbox" defaultChecked={d?.emailed_two_weeks ?? false} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
              The 2-weeks-to-go team email has gone out
            </label>
          </Field>
          <Field label="Instantly emails created" htmlFor="instantly_created" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input id="instantly_created" name="instantly_created" type="checkbox" defaultChecked={d?.instantly_created ?? false} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
              Instantly campaign emails created
            </label>
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
          href={redirectTo ?? (show ? `/shows/${show.id}` : "/shows")}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
