"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import { Constants, type Tables } from "@/lib/database.types";
import { DESTINATION_LABELS, DIRECTION_META, deriveDirection } from "@/lib/shipments";
import { formatCurrency } from "@/lib/format";
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
  redirectTo,
}: {
  action: (prev: ShipmentFormState, fd: FormData) => Promise<ShipmentFormState>;
  shipment?: ShipmentRow;
  shows: Opt[];
  exhibitors: Opt[];
  defaults?: { show_id?: string; exhibitor_id?: string };
  submitLabel: string;
  redirectTo?: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = shipment;

  const showId = d?.show_id ?? defaults?.show_id ?? "";
  const exhibitorId = d?.exhibitor_id ?? defaults?.exhibitor_id ?? "";

  // Live margin preview as the operator types billed/cost (the DB also stores
  // margin as a generated column, so this is just an instant readout).
  const [billed, setBilled] = useState(d?.billed_amount != null ? String(d.billed_amount) : "");
  const [cost, setCost] = useState(d?.cost_amount != null ? String(d.cost_amount) : "");
  const billedNum = Number.parseFloat(billed.replace(/[$,\s]/g, ""));
  const costNum = Number.parseFloat(cost.replace(/[$,\s]/g, ""));
  const margin =
    Number.isFinite(billedNum) && Number.isFinite(costNum) ? billedNum - costNum : null;

  return (
    <form action={formAction}>
      {shipment ? <input type="hidden" name="id" value={shipment.id} /> : null}
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}

      <Card>
        <FormSection
          title="Assignment"
          description="Link this shipment to a show and exhibitor, and enter its Brokerware load number. Freight details — carrier, status, weight, dates, PRO — then sync automatically from the TMS."
        >
          <Field
            label="Load number"
            htmlFor="tms_reference_id"
            hint="Brokerware load number — links this shipment to live TMS tracking."
            error={err.tms_reference_id}
            className="sm:col-span-2"
          >
            <input id="tms_reference_id" name="tms_reference_id" defaultValue={d?.tms_reference_id ?? ""} className={inputClass} placeholder="e.g. 109813" />
          </Field>
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
          <Field label="PO reference" htmlFor="po_ref" hint="Show / exhibitor purchase-order number.">
            <input id="po_ref" name="po_ref" defaultValue={d?.po_ref ?? ""} className={inputClass} />
          </Field>
          <Field label="Shipper number" htmlFor="shipper_number" hint="Shipper's own reference number.">
            <input id="shipper_number" name="shipper_number" defaultValue={d?.shipper_number ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Move-in & deadline"
          description="Direction and the must-deliver-by target drive the on-track indicators. Leave a date blank to inherit it from the linked show."
        >
          <Field label="Direction" htmlFor="direction" hint="Move-in = into the show; move-out = back from it.">
            <select id="direction" name="direction" defaultValue={d?.direction ?? deriveDirection(d?.destination_type) ?? ""} className={inputClass}>
              <option value="">— Select —</option>
              {Constants.public.Enums.shipment_direction.map((dir) => (
                <option key={dir} value={dir}>{DIRECTION_META[dir].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Target delivery date" htmlFor="target_delivery_date" hint="Must-arrive-by deadline. Blank = the show's move-in start (move-out end for move-outs).">
            <input id="target_delivery_date" name="target_delivery_date" type="date" defaultValue={d?.target_delivery_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Show date" htmlFor="show_date" hint="Move-in / move-out date. Blank = use the show's date.">
            <input id="show_date" name="show_date" type="date" defaultValue={d?.show_date ?? ""} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="Financials"
          description="Customer billing and carrier cost for this shipment. Margin is calculated automatically from billed minus cost."
        >
          <Field label="Billed (customer)" htmlFor="billed_amount">
            <input
              id="billed_amount"
              name="billed_amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={billed}
              onChange={(e) => setBilled(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </Field>
          <Field label="Cost (carrier)" htmlFor="cost_amount">
            <input
              id="cost_amount"
              name="cost_amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </Field>
          <Field label="Margin" htmlFor="margin_display" hint="Billed minus cost — saved automatically." className="sm:col-span-2">
            <input
              id="margin_display"
              disabled
              value={margin == null ? "" : formatCurrency(margin, { cents: true })}
              placeholder="—"
              className={inputClass}
            />
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
