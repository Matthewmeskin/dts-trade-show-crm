"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Field, FormSection, inputClass } from "@/components/form";
import {
  DTS_BILL_TO,
  ACCESSORIAL_FIELDS,
  LEVEL_OF_SERVICE_OPTIONS,
  type MoveOutShipment,
  type Party,
} from "@/lib/move-out/types";

/**
 * "Edit move-out form" — opens the outbound shipping form prefilled from the
 * shipment, lets the operator adjust any field (ship-to, carrier, service,
 * accessorials, special instructions…), then generates the PDF from those
 * edits. Nothing is saved back to the shipment; it just produces the paperwork.
 *
 * `initial` may be passed by callers that already mapped the defaults (the
 * shipment page). Callers that only have the id (the side panel) omit it and
 * the defaults are fetched from `/api/move-out/<id>?format=json` on open.
 */
export function MoveOutEditor({
  shipmentId,
  initial,
}: {
  shipmentId: string;
  initial?: MoveOutShipment;
}) {
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<MoveOutShipment | null>(initial ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || defaults) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/move-out/${shipmentId}?format=json`);
        if (!res.ok) throw new Error(`Couldn't load the form (${res.status}).`);
        const json = (await res.json()) as MoveOutShipment;
        if (!cancelled) setDefaults(json);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaults, shipmentId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Icon name="documents" className="h-4 w-4" /> Edit move-out form
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
        >
          {defaults ? (
            <EditorForm
              shipmentId={shipmentId}
              initial={defaults}
              onClose={() => setOpen(false)}
            />
          ) : (
            <div className="mt-16 rounded-2xl bg-white px-6 py-5 text-sm text-slate-600 shadow-xl">
              {loadError ? (
                <span className="text-dts-maroon">{loadError}</span>
              ) : (
                "Loading move-out form…"
              )}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function EditorForm({
  shipmentId,
  initial,
  onClose,
}: {
  shipmentId: string;
  initial: MoveOutShipment;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<MoveOutShipment>(() => ({
    ...initial,
    shipTo: { ...initial.shipTo },
    billTo: { ...(initial.billTo ?? DTS_BILL_TO) },
    carrier: { ...initial.carrier },
    accessorials: { ...(initial.accessorials ?? {}) },
    levelOfService: initial.levelOfService ?? "ground",
  }));
  const [specialText, setSpecialText] = useState(
    (initial.extraInstructions ?? []).join("\n"),
  );

  const setShipTo = (patch: Partial<Party>) =>
    setF((p) => ({ ...p, shipTo: { ...p.shipTo, ...patch } }));
  const setBillTo = (patch: Partial<Party>) =>
    setF((p) => ({ ...p, billTo: { ...(p.billTo ?? DTS_BILL_TO), ...patch } }));
  const setCarrier = (patch: Partial<{ name: string; phone?: string }>) =>
    setF((p) => ({ ...p, carrier: { ...p.carrier, ...patch } }));
  const toggleAcc = (key: keyof NonNullable<MoveOutShipment["accessorials"]>) =>
    setF((p) => ({
      ...p,
      accessorials: { ...p.accessorials, [key]: !p.accessorials?.[key] },
    }));

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const payload: MoveOutShipment = {
        ...f,
        extraInstructions: specialText
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      };
      const res = await fetch(`/api/move-out/${shipmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Couldn't generate the form (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const bill = f.billTo ?? DTS_BILL_TO;

  return (
    <div
      className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Edit move-out form
          </h2>
          <p className="text-xs text-slate-400">
            Prefilled from the shipment. Edits apply to the PDF only.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormSection title="Show & exhibitor">
          <Field label="Show name" htmlFor="mo_show">
            <input id="mo_show" className={inputClass} value={f.showName}
              onChange={(e) => setF((p) => ({ ...p, showName: e.target.value }))} />
          </Field>
          <Field label="Booth #" htmlFor="mo_booth">
            <input id="mo_booth" className={inputClass} value={f.booth ?? ""}
              onChange={(e) => setF((p) => ({ ...p, booth: e.target.value }))} />
          </Field>
          <Field label="Company name" htmlFor="mo_company" className="sm:col-span-2">
            <input id="mo_company" className={inputClass} value={f.exhibitorCompany}
              onChange={(e) => setF((p) => ({ ...p, exhibitorCompany: e.target.value }))} />
          </Field>
          <Field label="Contact name" htmlFor="mo_cname">
            <input id="mo_cname" className={inputClass} value={f.contactName ?? ""}
              onChange={(e) => setF((p) => ({ ...p, contactName: e.target.value }))} />
          </Field>
          <Field label="Contact phone" htmlFor="mo_cphone">
            <input id="mo_cphone" className={inputClass} value={f.contactPhone ?? ""}
              onChange={(e) => setF((p) => ({ ...p, contactPhone: e.target.value }))} />
          </Field>
          <Field label="E-mail address" htmlFor="mo_cemail" className="sm:col-span-2">
            <input id="mo_cemail" className={inputClass} value={f.contactEmail ?? ""}
              onChange={(e) => setF((p) => ({ ...p, contactEmail: e.target.value }))} />
          </Field>
        </FormSection>

        <FormSection title="Ship to" description="The consignee the freight returns to.">
          <PartyFields idPrefix="mo_ship" party={f.shipTo} onChange={setShipTo} />
        </FormSection>

        <FormSection title="Bill to" description="Defaults to Diversified Transportation Services.">
          <PartyFields idPrefix="mo_bill" party={bill} onChange={setBillTo} showAttn={false} />
        </FormSection>

        <FormSection title="Carrier & service">
          <Field label="Carrier name" htmlFor="mo_carrier">
            <input id="mo_carrier" className={inputClass} value={f.carrier.name}
              onChange={(e) => setCarrier({ name: e.target.value })} />
          </Field>
          <Field label="Carrier phone" htmlFor="mo_carrierphone">
            <input id="mo_carrierphone" className={inputClass} value={f.carrier.phone ?? ""}
              onChange={(e) => setCarrier({ phone: e.target.value })} />
          </Field>
          <Field label="Level of service" htmlFor="mo_los" className="sm:col-span-2">
            <select id="mo_los" className={inputClass} value={f.levelOfService ?? "ground"}
              onChange={(e) => setF((p) => ({ ...p, levelOfService: e.target.value as MoveOutShipment["levelOfService"] }))}>
              {LEVEL_OF_SERVICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Shipment options">
          <div className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2">
            {ACCESSORIAL_FIELDS.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon"
                  checked={!!f.accessorials?.[a.key]}
                  onChange={() => toggleAcc(a.key)}
                />
                {a.label}
              </label>
            ))}
          </div>
          <Field label="Special instructions" htmlFor="mo_special" className="sm:col-span-2"
            hint="One instruction per line (e.g. Call before delivery).">
            <textarea id="mo_special" rows={3} className={inputClass} value={specialText}
              onChange={(e) => setSpecialText(e.target.value)} />
          </Field>
          <Field label="Desired number of labels" htmlFor="mo_labels">
            <input id="mo_labels" type="number" min={0} className={inputClass}
              value={f.numberOfLabels ?? ""}
              onChange={(e) => setF((p) => ({
                ...p,
                numberOfLabels: e.target.value === "" ? undefined : Number(e.target.value),
              }))} />
          </Field>
        </FormSection>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
        <span className="text-sm text-dts-maroon">{error}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="documents" className="h-4 w-4" />
            {busy ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartyFields({
  idPrefix,
  party,
  onChange,
  showAttn = true,
}: {
  idPrefix: string;
  party: Party;
  onChange: (patch: Partial<Party>) => void;
  showAttn?: boolean;
}) {
  return (
    <>
      <Field label="Company" htmlFor={`${idPrefix}_company`} className="sm:col-span-2">
        <input id={`${idPrefix}_company`} className={inputClass} value={party.company}
          onChange={(e) => onChange({ company: e.target.value })} />
      </Field>
      <Field label="Address line 1" htmlFor={`${idPrefix}_addr1`}>
        <input id={`${idPrefix}_addr1`} className={inputClass} value={party.address1}
          onChange={(e) => onChange({ address1: e.target.value })} />
      </Field>
      <Field label="Address line 2" htmlFor={`${idPrefix}_addr2`}>
        <input id={`${idPrefix}_addr2`} className={inputClass} value={party.address2 ?? ""}
          onChange={(e) => onChange({ address2: e.target.value })} />
      </Field>
      <Field label="City" htmlFor={`${idPrefix}_city`}>
        <input id={`${idPrefix}_city`} className={inputClass} value={party.city}
          onChange={(e) => onChange({ city: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State" htmlFor={`${idPrefix}_state`}>
          <input id={`${idPrefix}_state`} className={inputClass} value={party.state}
            onChange={(e) => onChange({ state: e.target.value })} />
        </Field>
        <Field label="ZIP" htmlFor={`${idPrefix}_zip`}>
          <input id={`${idPrefix}_zip`} className={inputClass} value={party.zip}
            onChange={(e) => onChange({ zip: e.target.value })} />
        </Field>
      </div>
      <Field label="Phone #" htmlFor={`${idPrefix}_phone`}>
        <input id={`${idPrefix}_phone`} className={inputClass} value={party.phone ?? ""}
          onChange={(e) => onChange({ phone: e.target.value })} />
      </Field>
      {showAttn ? (
        <Field label="Attn" htmlFor={`${idPrefix}_attn`}>
          <input id={`${idPrefix}_attn`} className={inputClass} value={party.attn ?? ""}
            onChange={(e) => onChange({ attn: e.target.value })} />
        </Field>
      ) : null}
    </>
  );
}
