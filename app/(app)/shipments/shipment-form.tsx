"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import { Constants, type Tables } from "@/lib/database.types";
import {
  SHIPMENT_STATUS_META,
  DESTINATION_LABELS,
  TMS_SYNC_META,
} from "@/lib/shipments";
import type { ShipmentFormState } from "./actions";

type ShipmentRow = Tables<"shipments">;
type Opt = { id: string; label: string };

export function ShipmentForm({
  action,
  shipment,
  shows,
  exhibitors,
  carriers,
  defaults,
  submitLabel,
}: {
  action: (prev: ShipmentFormState, fd: FormData) => Promise<ShipmentFormState>;
  shipment?: ShipmentRow;
  shows: Opt[];
  exhibitors: Opt[];
  carriers: Opt[];
  defaults?: { show_id?: string; exhibitor_id?: string };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = shipment;

  const showId = d?.show_id ?? defaults?.show_id ?? "";
  const exhibitorId = d?.exhibitor_id ?? defaults?.exhibitor_id ?? "";

  return (
    <form action={formAction}>
      {shipment ? <input type="hidden" name="id" value={shipment.id} /> : null}

      <Card>
        <FormSection title="Assignment">
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
          <Field label="Carrier" htmlFor="carrier_id">
            <select id="carrier_id" name="carrier_id" defaultValue={d?.carrier_id ?? ""} className={inputClass}>
              <option value="">— Select carrier —</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={d?.status ?? "quoted"} className={inputClass}>
              {Constants.public.Enums.shipment_status.map((s) => (
                <option key={s} value={s}>{SHIPMENT_STATUS_META[s].label}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Origin">
          <Field label="Street" htmlFor="origin_street" className="sm:col-span-2">
            <input id="origin_street" name="origin_street" defaultValue={d?.origin_street ?? ""} className={inputClass} />
          </Field>
          <Field label="City" htmlFor="origin_city">
            <input id="origin_city" name="origin_city" defaultValue={d?.origin_city ?? ""} className={inputClass} />
          </Field>
          <Field label="State" htmlFor="origin_state">
            <input id="origin_state" name="origin_state" defaultValue={d?.origin_state ?? ""} className={inputClass} />
          </Field>
          <Field label="ZIP" htmlFor="origin_zip">
            <input id="origin_zip" name="origin_zip" defaultValue={d?.origin_zip ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection title="Shipment details">
          <Field label="Destination" htmlFor="destination_type">
            <select id="destination_type" name="destination_type" defaultValue={d?.destination_type ?? ""} className={inputClass}>
              <option value="">— Select —</option>
              {Constants.public.Enums.shipment_destination.map((dst) => (
                <option key={dst} value={dst}>{DESTINATION_LABELS[dst]}</option>
              ))}
            </select>
          </Field>
          <Field label="Mode" htmlFor="mode">
            <select id="mode" name="mode" defaultValue={d?.mode ?? ""} className={inputClass}>
              <option value="">— Select —</option>
              {Constants.public.Enums.shipment_mode.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Pieces" htmlFor="pieces">
            <input id="pieces" name="pieces" type="number" defaultValue={d?.pieces ?? ""} className={inputClass} />
          </Field>
          <Field label="Weight (lbs)" htmlFor="weight">
            <input id="weight" name="weight" inputMode="decimal" defaultValue={d?.weight ?? ""} className={inputClass} />
          </Field>
          <Field label="PRO number" htmlFor="pro_number">
            <input id="pro_number" name="pro_number" defaultValue={d?.pro_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Pickup date" htmlFor="pickup_date">
            <input id="pickup_date" name="pickup_date" type="date" defaultValue={d?.pickup_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Est. delivery" htmlFor="estimated_delivery_date">
            <input id="estimated_delivery_date" name="estimated_delivery_date" type="date" defaultValue={d?.estimated_delivery_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Actual delivery" htmlFor="actual_delivery_date">
            <input id="actual_delivery_date" name="actual_delivery_date" type="date" defaultValue={d?.actual_delivery_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Accessorials" htmlFor="accessorials_flagged" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input id="accessorials_flagged" name="accessorials_flagged" type="checkbox" defaultChecked={d?.accessorials_flagged ?? false} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
              Flag accessorials for review
            </label>
          </Field>
        </FormSection>

        <FormSection
          title="TMS / BrokerWareLite"
          description="Set automatically by the n8n integration; editable for manual records."
        >
          <Field label="TMS reference ID" htmlFor="tms_reference_id" error={err.tms_reference_id} hint="BrokerWareLite load ID — must be unique.">
            <input id="tms_reference_id" name="tms_reference_id" defaultValue={d?.tms_reference_id ?? ""} className={inputClass} />
          </Field>
          <Field label="Sync status" htmlFor="tms_sync_status">
            <select id="tms_sync_status" name="tms_sync_status" defaultValue={d?.tms_sync_status ?? "manual"} className={inputClass}>
              {Constants.public.Enums.tms_sync_status.map((t) => (
                <option key={t} value={t}>{TMS_SYNC_META[t].label}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Notes">
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
