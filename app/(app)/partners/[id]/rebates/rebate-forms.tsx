"use client";

import { useActionState } from "react";
import { SubmitButton, inputClass } from "@/components/form";
import {
  creditShipments,
  issueRebateStatement,
  markRebatePaid,
  setShipmentPartner,
  type RebateState,
} from "../../rebate-actions";

const empty: RebateState = { error: null };
const small = inputClass.replace("py-2", "py-1.5");

function Result({ state }: { state: RebateState }) {
  if (state.error) return <span className="text-sm text-dts-maroon">{state.error}</span>;
  if (state.ok) return <span className="text-sm text-emerald-600">{state.message ?? "Saved."}</span>;
  return null;
}

export function IssueForm({
  partnerId,
  quarter,
  total,
  label,
}: {
  partnerId: string;
  quarter: string;
  total: number;
  label: string;
}) {
  const [state, action] = useActionState(issueRebateStatement, empty);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="quarter" value={quarter} />
      <input type="hidden" name="expected_total" value={total} />
      <SubmitButton pendingLabel="Issuing…">{label}</SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function MarkPaidForm({ statementId, partnerId, today }: { statementId: string; partnerId: string; today: string }) {
  const [state, action] = useActionState(markRebatePaid, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="statement_id" value={statementId} />
      <input type="hidden" name="partner_id" value={partnerId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-slate-600">
          Paid on
          <input type="date" name="paid_on" defaultValue={today} className={small} />
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          Check / ACH ref
          <input name="paid_ref" className={small} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Mark paid</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  );
}

/** The ticked client loads on the partner page. */
export function CreditSuggestionsForm({
  partnerId,
  rows,
}: {
  partnerId: string;
  rows: { id: string; label: string; detail: string }[];
}) {
  const [state, action] = useActionState(creditShipments, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
        {rows.map((r) => (
          <li key={r.id}>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="shipment_id" value={r.id} defaultChecked className="mt-0.5 h-4 w-4 accent-dts-maroon" />
              <span>
                <span className="text-slate-800">{r.label}</span>
                <span className="block text-xs text-slate-400">{r.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Crediting…">Credit ticked loads</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  );
}

/** On the shipment page: who gets credit for this load. */
export function ShipmentPartnerForm({
  shipmentId,
  partnerId,
  source,
  partners,
  locked,
}: {
  shipmentId: string;
  partnerId: string | null;
  source: string | null;
  partners: { id: string; label: string }[];
  locked: boolean;
}) {
  const [state, action] = useActionState(setShipmentPartner, empty);
  if (locked) {
    return <p className="text-xs text-slate-500">On a rebate statement already, so the credit is locked.</p>;
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="shipment_id" value={shipmentId} />
      <select name="partner_id" defaultValue={partnerId ?? ""} className={small}>
        <option value="">No partner</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <select name="source" defaultValue={source ?? "referral_code"} className={small}>
        <option value="referral_code">Came in on their partner code</option>
        <option value="client">They&apos;re the partner&apos;s client</option>
        <option value="manual">Rep&apos;s call (note why in the notes)</option>
      </select>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  );
}
