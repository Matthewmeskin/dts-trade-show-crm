"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import type { VenueFormState } from "./actions";
import type { Tables } from "@/lib/database.types";

type VenueRow = Tables<"venues">;

export function VenueForm({
  action,
  venue,
  defaults,
  submitLabel,
  redirectTo,
}: {
  action: (prev: VenueFormState, fd: FormData) => Promise<VenueFormState>;
  venue?: VenueRow;
  defaults?: Partial<VenueRow>;
  submitLabel: string;
  redirectTo?: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = venue ?? defaults;

  return (
    <form action={formAction}>
      {venue ? <input type="hidden" name="id" value={venue.id} /> : null}
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}

      <Card>
        <FormSection title="Venue">
          <Field label="Venue name" htmlFor="venue_name" required error={err.venue_name} className="sm:col-span-2">
            <input id="venue_name" name="venue_name" defaultValue={d?.venue_name ?? ""} className={inputClass} placeholder="e.g. Las Vegas Convention Center" />
          </Field>
          <Field label="City" htmlFor="city">
            <input id="city" name="city" defaultValue={d?.city ?? ""} className={inputClass} />
          </Field>
          <Field label="State" htmlFor="state">
            <input id="state" name="state" defaultValue={d?.state ?? ""} className={inputClass} placeholder="NV" />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <input id="address" name="address" defaultValue={d?.address ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Logistics intel"
          description="Reusable across shows — intel accumulates here over time."
        >
          <Field label="Dock notes" htmlFor="dock_notes" className="sm:col-span-2">
            <textarea id="dock_notes" name="dock_notes" rows={3} defaultValue={d?.dock_notes ?? ""} className={inputClass} />
          </Field>
          <Field label="Union rules" htmlFor="union_rules" className="sm:col-span-2">
            <textarea id="union_rules" name="union_rules" rows={3} defaultValue={d?.union_rules ?? ""} className={inputClass} />
          </Field>
          <Field label="Delivery restrictions" htmlFor="delivery_restrictions" className="sm:col-span-2">
            <textarea id="delivery_restrictions" name="delivery_restrictions" rows={3} defaultValue={d?.delivery_restrictions ?? ""} className={inputClass} />
          </Field>
          <Field label="Parking & staging notes" htmlFor="parking_and_staging_notes" className="sm:col-span-2">
            <textarea id="parking_and_staging_notes" name="parking_and_staging_notes" rows={3} defaultValue={d?.parking_and_staging_notes ?? ""} className={inputClass} />
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
          href={redirectTo ?? (venue ? `/venues/${venue.id}` : "/venues")}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
