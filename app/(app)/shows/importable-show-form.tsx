"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { inputClass } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { ShowForm } from "./show-form";
import { createShow } from "./actions";

type VenueOpt = Pick<Tables<"venues">, "id" | "venue_name" | "city" | "state">;
type ContactOpt = Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "company">;

const DATE_FIELDS = [
  "show_start_date",
  "show_end_date",
  "move_in_start",
  "move_in_end",
  "move_out_start",
  "move_out_end",
  "advance_warehouse_open",
  "advance_warehouse_cutoff",
  "direct_to_show_start",
  "direct_to_show_end",
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = str(v);
  if (!s) return undefined;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

// Words too generic to distinguish one venue from another.
const VENUE_STOPWORDS = new Set([
  "the", "convention", "center", "centre", "conv", "ctr", "expo", "exposition",
  "hall", "complex", "of", "and", "at", "fairgrounds", "fairground",
]);
const normVenue = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const venueTokens = (s: string) =>
  normVenue(s).split(" ").filter((t) => t && !VENUE_STOPWORDS.has(t));

/**
 * Best-effort match of a free-text venue name (from the Quick Facts doc, which
 * may include a city/state or differ from our record's exact wording) to an
 * existing venue. Tries exact → substring → distinctive-token containment.
 */
function matchVenueId(venueRaw: string, venues: VenueOpt[]): string | undefined {
  const candidates = [venueRaw, venueRaw.split(",")[0]]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const cand of candidates) {
    const cn = normVenue(cand);
    const exact = venues.find((v) => normVenue(v.venue_name) === cn);
    if (exact) return exact.id;
  }
  for (const cand of candidates) {
    const cn = normVenue(cand);
    if (!cn) continue;
    const sub = venues.find((v) => {
      const vn = normVenue(v.venue_name);
      return vn === cn || vn.includes(cn) || cn.includes(vn);
    });
    if (sub) return sub.id;
  }
  for (const cand of candidates) {
    const ct = new Set(venueTokens(cand));
    if (ct.size === 0) continue;
    const tok = venues.find((v) => {
      const vt = new Set(venueTokens(v.venue_name));
      if (vt.size === 0) return false;
      const candInVenue = [...ct].every((t) => vt.has(t));
      const venueInCand = [...vt].every((t) => ct.has(t));
      return candInVenue || venueInCand;
    });
    if (tok) return tok.id;
  }
  return undefined;
}

/** Map the AI's JSON onto the New Show form's defaults. */
function mapExtracted(fields: Record<string, unknown>, venues: VenueOpt[]): Partial<Tables<"shows">> {
  const out: Partial<Tables<"shows">> = {};
  out.show_name = str(fields.show_name);
  out.edition_year = num(fields.edition_year);
  out.industry_vertical = str(fields.industry_vertical);
  out.show_management_company = str(fields.show_management_company);
  for (const prefix of ["advance_warehouse", "direct_to_show"] as const) {
    for (const part of ["name", "care_of", "street1", "street2", "city", "state", "zip", "country"] as const) {
      const key = `${prefix}_${part}` as const;
      out[key] = str(fields[key]);
    }
  }
  out.competitor_notes = str(fields.competitor_notes);
  out.estimated_revenue = num(fields.estimated_revenue);
  out.actual_revenue = num(fields.actual_revenue);

  for (const f of DATE_FIELDS) {
    const v = str(fields[f]);
    if (v && ISO_DATE.test(v)) out[f] = v;
  }

  // Venue is free text from the doc; fuzzily match it to an existing venue so
  // it gets pre-selected when one is available.
  const venueName = str(fields.venue);
  if (venueName) {
    const venueId = matchVenueId(venueName, venues);
    if (venueId) out.venue_id = venueId;
  }

  // The GSC contact must be picked from existing contacts — keep the extracted
  // name in general notes so it isn't lost.
  const gsc = str(fields.primary_gsc_contact);
  const generalNotes = str(fields.general_notes);
  out.general_notes =
    [generalNotes, gsc ? `Primary GSC contact (from Quick Facts): ${gsc}` : null]
      .filter(Boolean)
      .join("\n\n") || undefined;

  return out;
}

export function ImportableShowForm({
  venues,
  contacts,
}: {
  venues: VenueOpt[];
  contacts: ContactOpt[];
}) {
  const [defaults, setDefaults] = useState<Partial<Tables<"shows">>>({});
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Extraction failed.");
        return;
      }
      setDefaults(mapExtracted(data.fields ?? {}, venues));
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
          <Icon name="sparkles" className="h-4 w-4" /> Import from Quick Facts
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
              <h2 className="font-heading text-lg font-semibold text-slate-900">Import from Quick Facts</h2>
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
              Paste the raw text from a Freeman Quick Facts page. The AI fills in the form below —
              review and correct before saving. Venue and GSC contact must be selected from your
              existing records.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste the Quick Facts text here…"
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

      <ShowForm
        key={formKey}
        action={createShow}
        defaults={defaults}
        venues={venues}
        contacts={contacts}
        submitLabel="Create show"
      />
    </div>
  );
}
