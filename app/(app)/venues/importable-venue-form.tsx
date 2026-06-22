"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { inputClass } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { VenueForm } from "./venue-form";
import { createVenue } from "./actions";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Map the AI's JSON onto the New Venue form's defaults. */
function mapExtracted(fields: Record<string, unknown>): Partial<Tables<"venues">> {
  const out: Partial<Tables<"venues">> = {};
  out.venue_name = str(fields.venue_name);
  out.address = str(fields.address);
  out.city = str(fields.city);
  const state = str(fields.state);
  out.state = state ? state.slice(0, 2).toUpperCase() : undefined;
  out.dock_notes = str(fields.dock_notes);
  out.union_rules = str(fields.union_rules);
  out.delivery_restrictions = str(fields.delivery_restrictions);
  out.parking_and_staging_notes = str(fields.parking_and_staging_notes);
  out.general_notes = str(fields.general_notes);
  return out;
}

export function ImportableVenueForm() {
  const [defaults, setDefaults] = useState<Partial<Tables<"venues">>>({});
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Extraction failed.");
        return;
      }
      setDefaults(mapExtracted(data.fields ?? {}));
      setFormKey((k) => k + 1);
      setOpen(false);
      setText("");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dts-maroon/30 bg-dts-maroon/5 px-3.5 py-2 text-sm font-medium text-dts-maroon transition hover:bg-dts-maroon/10"
        >
          <Icon name="sparkles" className="h-4 w-4" /> Import venue details
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-slate-900">Import venue details</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Paste text about the venue — a facilities page, a show&apos;s freight/marshalling
              instructions, or the logistics section of a Quick Facts doc. The AI fills in the form
              below (name, address, dock, union, delivery, parking notes) — review before saving.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste the venue text here…"
              className={`${inputClass} font-mono text-xs`}
            />
            {error ? (
              <p className="mt-2 rounded-lg bg-dts-maroon/5 px-3 py-2 text-sm text-dts-maroon">{error}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={extract}
                disabled={loading || !text.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Extracting…" : "Extract fields"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <VenueForm
        key={formKey}
        action={createVenue}
        defaults={defaults}
        submitLabel="Create venue"
      />
    </div>
  );
}
