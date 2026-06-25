"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { Field, inputClass } from "@/components/form";
import { applyVenueLogistics } from "../actions";

type Discovered = {
  address: string | null;
  city: string | null;
  state: string | null;
  dock_notes: string | null;
  union_rules: string | null;
  delivery_restrictions: string | null;
  parking_and_staging_notes: string | null;
  general_notes: string | null;
  confidence: "high" | "medium" | "low";
  sources: string[];
};

const CONF = {
  high: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

/** "Fill logistics with AI" — web-search the venue's freight info, review, apply. */
export function EnrichVenueButton({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Discovered | null>(null);
  const [f, setF] = useState({
    address: "", city: "", state: "", dock_notes: "", union_rules: "",
    delivery_restrictions: "", parking_and_staging_notes: "", general_notes: "",
  });

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest/venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Lookup failed.");
        return;
      }
      const dd = json.data as Discovered;
      setD(dd);
      setF({
        address: dd.address ?? "", city: dd.city ?? "", state: dd.state ?? "",
        dock_notes: dd.dock_notes ?? "", union_rules: dd.union_rules ?? "",
        delivery_restrictions: dd.delivery_restrictions ?? "",
        parking_and_staging_notes: dd.parking_and_staging_notes ?? "",
        general_notes: dd.general_notes ?? "",
      });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setSaving(true);
    const fd = new FormData();
    fd.set("id", venueId);
    for (const [k, v] of Object.entries(f)) if (v.trim()) fd.set(k, v);
    await applyVenueLogistics(fd);
    setSaving(false);
    setD(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dts-maroon/30 bg-dts-maroon/5 px-3 py-2 text-sm font-medium text-dts-maroon transition hover:bg-dts-maroon/10 disabled:opacity-60"
      >
        <Icon name="sparkles" className="h-4 w-4" /> {busy ? "Searching…" : "Fill logistics with AI"}
      </button>

      {error ? <p className="mt-1 text-xs text-dts-maroon">{error}</p> : null}

      {d
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onClick={() => setD(null)} role="dialog" aria-modal="true">
              <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-semibold text-slate-900">AI venue logistics</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONF[d.confidence]}`}>confidence: {d.confidence}</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Review and edit before applying. Saving fills these fields on the venue.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Address" htmlFor="va"><input id="va" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={inputClass} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" htmlFor="vc"><input id="vc" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={inputClass} /></Field>
                    <Field label="State" htmlFor="vs"><input id="vs" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className={inputClass} /></Field>
                  </div>
                  <Field label="Dock notes" htmlFor="vd" className="sm:col-span-2"><textarea id="vd" rows={2} value={f.dock_notes} onChange={(e) => setF({ ...f, dock_notes: e.target.value })} className={inputClass} /></Field>
                  <Field label="Union rules" htmlFor="vu" className="sm:col-span-2"><textarea id="vu" rows={2} value={f.union_rules} onChange={(e) => setF({ ...f, union_rules: e.target.value })} className={inputClass} /></Field>
                  <Field label="Delivery restrictions" htmlFor="vr" className="sm:col-span-2"><textarea id="vr" rows={2} value={f.delivery_restrictions} onChange={(e) => setF({ ...f, delivery_restrictions: e.target.value })} className={inputClass} /></Field>
                  <Field label="Parking & staging" htmlFor="vp" className="sm:col-span-2"><textarea id="vp" rows={2} value={f.parking_and_staging_notes} onChange={(e) => setF({ ...f, parking_and_staging_notes: e.target.value })} className={inputClass} /></Field>
                  <Field label="General notes" htmlFor="vg" className="sm:col-span-2"><textarea id="vg" rows={2} value={f.general_notes} onChange={(e) => setF({ ...f, general_notes: e.target.value })} className={inputClass} /></Field>
                </div>
                {d.sources.length ? (
                  <div className="mt-3 text-xs text-slate-400">Sources: {d.sources.map((u, i) => (<a key={i} href={u} target="_blank" rel="noopener noreferrer" className="mr-2 text-dts-blue hover:underline">[{i + 1}]</a>))}</div>
                ) : null}
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setD(null)} className="text-sm font-medium text-slate-500 hover:text-slate-900">Cancel</button>
                  <button type="button" onClick={apply} disabled={saving} className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60">{saving ? "Saving…" : "Save to venue"}</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
