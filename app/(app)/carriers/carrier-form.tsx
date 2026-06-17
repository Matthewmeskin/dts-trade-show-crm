"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, SubmitButton, inputClass } from "@/components/form";
import type { CarrierFormState } from "./actions";
import type { Tables } from "@/lib/database.types";

type CarrierRow = Tables<"carriers">;

export function CarrierForm({
  action,
  carrier,
  submitLabel,
}: {
  action: (prev: CarrierFormState, fd: FormData) => Promise<CarrierFormState>;
  carrier?: CarrierRow;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const err = state.fieldErrors ?? {};
  const d = carrier;

  return (
    <form action={formAction}>
      {carrier ? <input type="hidden" name="id" value={carrier.id} /> : null}

      <Card>
        <FormSection title="Carrier">
          <Field label="Carrier name" htmlFor="carrier_name" required error={err.carrier_name} className="sm:col-span-2">
            <input id="carrier_name" name="carrier_name" defaultValue={d?.carrier_name ?? ""} className={inputClass} placeholder="e.g. Roadrunner Freight" />
          </Field>
          <Field label="Trade show notes" htmlFor="trade_show_notes" className="sm:col-span-2" hint="Strengths, lanes, contacts, quirks — intel accumulates here.">
            <textarea id="trade_show_notes" name="trade_show_notes" rows={5} defaultValue={d?.trade_show_notes ?? ""} className={inputClass} />
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
          href={carrier ? `/carriers/${carrier.id}` : "/carriers"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
