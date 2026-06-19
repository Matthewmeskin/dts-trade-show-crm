"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Card, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatCurrency } from "@/lib/format";
import { importCandidate, importCandidates, dismissCandidate } from "./actions";

export type Candidate = {
  id: string;
  load_number: string;
  ai_confidence: string | null;
  ai_reason: string | null;
  mode: string | null;
  tms_status: string | null;
  matched_venue: string | null;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  carrier_name: string | null;
  weight: number | null;
  pieces: number | null;
  po_ref: string | null;
  shipper_number: string | null;
  billed_amount: number | null;
  cost_amount: number | null;
};

const CONF_BADGE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/20",
};

const checkboxClass =
  "h-4 w-4 shrink-0 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon";

/** A submit button that disables itself when the selection is empty. */
function BulkButton({
  count,
  label,
  variant = "solid",
}: {
  count: number;
  label: string;
  variant?: "solid" | "outline";
}) {
  const { pending } = useFormStatus();
  const base =
    "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const cls =
    variant === "outline"
      ? `${base} border border-slate-300 text-slate-700 hover:bg-slate-50`
      : `${base} bg-dts-maroon text-white hover:bg-dts-maroon-dark`;
  return (
    <button type="submit" disabled={pending || count === 0} className={cls}>
      {pending ? "Adding…" : `${label} (${count})`}
    </button>
  );
}

export function LoadList({ candidates }: { candidates: Candidate[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = candidates.length > 0 && selected.size === candidates.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className={checkboxClass} />
          {selected.size > 0 ? `${selected.size} selected` : `Select all (${candidates.length})`}
        </label>
        <div className="flex items-center gap-2">
          <form action={importCandidates}>
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <BulkButton count={selected.size} label="Add selected" />
          </form>
          <form action={importCandidates}>
            {candidates.map((c) => (
              <input key={c.id} type="hidden" name="ids" value={c.id} />
            ))}
            <BulkButton count={candidates.length} label="Add all" variant="outline" />
          </form>
        </div>
      </div>

      {candidates.map((c) => {
        const conf = c.ai_confidence ?? "low";
        return (
          <Card key={c.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  aria-label={`Select load ${c.load_number}`}
                  className={`mt-1 ${checkboxClass}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">Load {c.load_number}</span>
                    <Badge className={CONF_BADGE[conf]}>{conf} confidence</Badge>
                    {c.mode ? <span className="text-xs text-slate-400">{c.mode}</span> : null}
                    {c.tms_status ? <span className="text-xs text-slate-400">· {c.tms_status}</span> : null}
                    {c.matched_venue ? (
                      <Badge className="bg-dts-blue/10 text-dts-blue">{c.matched_venue}</Badge>
                    ) : null}
                  </div>

                  <p className="text-sm text-slate-600">{c.ai_reason}</p>

                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                    {c.customer_name ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Customer:</dt>
                        <dd className="truncate font-medium text-slate-600">{c.customer_name}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-slate-400">Pickup:</dt>
                      <dd className="truncate">{c.pickup_location ?? "—"}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-slate-400">Delivery:</dt>
                      <dd className="truncate">{c.delivery_location ?? "—"}</dd>
                    </div>
                    {c.carrier_name ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Carrier:</dt>
                        <dd className="truncate">{c.carrier_name}</dd>
                      </div>
                    ) : null}
                    {c.weight != null ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Weight:</dt>
                        <dd>{c.weight} lbs{c.pieces != null ? ` · ${c.pieces} pcs` : ""}</dd>
                      </div>
                    ) : null}
                    {c.po_ref ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">PO ref:</dt>
                        <dd className="truncate">{c.po_ref}</dd>
                      </div>
                    ) : null}
                    {c.shipper_number ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Shipper #:</dt>
                        <dd className="truncate">{c.shipper_number}</dd>
                      </div>
                    ) : null}
                    {c.billed_amount != null || c.cost_amount != null ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Financials:</dt>
                        <dd className="truncate">
                          {formatCurrency(c.billed_amount, { cents: true })} billed
                          {" · "}
                          {formatCurrency(c.cost_amount, { cents: true })} cost
                          {c.billed_amount != null && c.cost_amount != null
                            ? ` · ${formatCurrency(c.billed_amount - c.cost_amount, { cents: true })} margin`
                            : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <form action={importCandidate}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton pendingLabel="Adding…">Add shipment</SubmitButton>
                </form>
                <form action={dismissCandidate}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    Dismiss
                  </button>
                </form>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
