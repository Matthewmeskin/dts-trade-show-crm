"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import { Constants, type Tables } from "@/lib/database.types";
import { DESTINATION_LABELS } from "@/lib/shipments";
import type { ShipmentFormState } from "./actions";

type ShipmentRow = Tables<"shipments">;
type Opt = { id: string; label: string };

/**
 * Operator-facing shipment form. Freight details (carrier, status, mode,
 * weight, dates, PRO, origin…) are owned by the TMS sync and intentionally
 * not editable here — operators only set what the sync never touches: the
 * show/exhibitor assignment, destination, and notes.
 */
export function ShipmentForm({
  action,
  shipment,
  shows,
  exhibitors,
  defaults,
  submitLabel,
}: {
  action: (prev: ShipmentFormState, fd: FormData) => Promise<ShipmentFormState>;
  shipment?: ShipmentRow;
  shows: Opt[];
  exhibitors: Opt[];
  defaults?: { show_id?: string; exhibitor_id?: string };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const d = shipment;

  const showId = d?.show_id ?? defaults?.show_id ?? "";
  const exhibitorId = d?.exhibitor_id ?? defaults?.exhibitor_id ?? "";

  return (
    <form action={formAction}>
      {shipment ? <input type="hidden" name="id" value={shipment.id} /> : null}

      <Card>
        <FormSection
          title="Assignment"
          description="Link this shipment to a show and exhibitor. Freight details — carrier, status, weight, dates, PRO — sync automatically from the TMS."
        >
          <Field label="Show" htmlFor="show_id">
            <select id="show_id" name="show_id" defaultValue={showId} className={inputClass}>
              <option value="">— Select show —</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Exhibitor" htmlFor="exhibitor_id">
            <select id="exhibitor_id" name="exhibitor_id" defaultValue={exhibitorId} className={inputClass}>
              <option value="">— Select exhibitor —</option>
              {exhibitors.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Destination" htmlFor="destination_type">
            <select id="destination_type" name="destination_type" defaultValue={d?.destination_type ?? ""} className={inputClass}>
              <option value="">— Select —</option>
              {Constants.public.Enums.shipment_destination.map((dst) => (
                <option key={dst} value={dst}>{DESTINATION_LABELS[dst]}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection
          title="Notes"
          description="Coordinator notes — a TMS sync never overwrites these."
        >
          <Field label="Special requirements" htmlFor="special_requirements" className="sm:col-span-2">
            <textarea id="special_requirements" name="special_requirements" rows={2} defaultValue={d?.special_requirements ?? ""} className={inputClass} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <textarea id="notes" name="notes" rows={3} defaultValue={d?.notes ?? ""} className={inputClass} />
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
          href={shipment ? `/shipments/${shipment.id}` : "/shipments"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
