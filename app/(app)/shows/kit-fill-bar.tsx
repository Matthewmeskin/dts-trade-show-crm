"use client";

import { useState, type RefObject } from "react";
import { inputClass } from "@/components/form";
import { Icon } from "@/components/icons";
import { KIT_SHOW_FACTS, kitFillForShow, type KitReading } from "@/lib/kit-reader";

type VenueOpt = { id: string; venue_name: string };

const PREFIXES = ["advance_warehouse", "direct_to_show", "marshalling_yard"] as const;
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Fill the show's edit form from its exhibitor kit instead of field by field.
 * Reads the kit (same reader as the Show page tab), then writes the kit's
 * dates and addresses into the fields of THIS form that are still empty and
 * highlights them. Nothing is saved until the person reads them over and
 * clicks Save changes; a field they already filled is never touched.
 */
export function KitFillBar({
  showId,
  formRef,
  defaultUrl,
  venues,
}: {
  showId: string;
  formRef: RefObject<HTMLFormElement | null>;
  defaultUrl: string | null;
  venues: VenueOpt[];
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ filled: string[]; skipped: string[]; warnings: string[] } | null>(null);

  function apply(reading: KitReading, kitUrl: string | null) {
    const form = formRef.current;
    if (!form) return;
    const el = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
    const mark = (e: HTMLInputElement | HTMLSelectElement) => e.classList.add("ring-2", "ring-sky-300", "bg-sky-50");

    // What the form holds right now, including anything typed but not saved.
    const current: Record<string, string> = {};
    for (const f of KIT_SHOW_FACTS) current[f] = el(f)?.value ?? "";
    for (const p of PREFIXES) {
      current[`${p}_street1`] = el(`${p}_street1`)?.value ?? "";
      current[`${p}_address`] = el(`${p}_address_legacy`)?.value ?? "";
    }
    const fill = kitFillForShow(reading.facts, current);

    const set = new Set<string>();
    for (const [k, v] of Object.entries(fill.values)) {
      const e = el(k);
      if (e && !e.value) {
        e.value = v;
        mark(e);
        set.add(k);
      }
    }
    const filled = fill.filled
      // Report only what landed in a field on this form.
      .filter((f) => {
        const prefix = PREFIXES.find((p) => f.field === `${p}_address`);
        return prefix ? set.has(`${prefix}_street1`) : set.has(f.field);
      })
      .map((f) => `${f.label}: ${f.value}`);

    // The kit link itself, if the show doesn't have one yet.
    const manual = el("exhibitor_manual_url");
    if (kitUrl && manual && !manual.value) {
      manual.value = kitUrl;
      mark(manual);
      filled.push(`Exhibitor manual link: ${kitUrl}`);
    }

    // The venue, only when exactly one venue we know is named in the kit's show-site address.
    const venue = el("venue_id");
    const siteLine = reading.facts.direct_to_show_address?.value ?? "";
    if (venue && !venue.value && siteLine) {
      const hits = venues.filter((v) => squash(v.venue_name).length > 5 && squash(siteLine).includes(squash(v.venue_name)));
      if (hits.length === 1) {
        venue.value = hits[0].id;
        mark(venue);
        filled.push(`Venue: ${hits[0].venue_name}`);
      }
    }

    setDone({
      filled,
      skipped: fill.skipped.map((s) => `${s.label}: ${s.value} (${s.why})`),
      warnings: reading.warnings,
    });
  }

  async function read() {
    setBusy(true);
    setError(null);
    setDone(null);
    const fd = new FormData();
    fd.set("show_id", showId);
    const pasted = text.trim().length > 40;
    if (pasted) fd.set("text", text);
    else if (file) fd.set("file", file);
    else fd.set("url", url);
    try {
      const res = await fetch("/api/read-kit", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!body?.ok) {
        setError(body?.error ?? (res.status === 413 ? "That PDF is too big to upload here — use the link instead." : "The reader failed. Try again."));
        return;
      }
      apply(body.reading as KitReading, pasted || file ? null : url);
    } catch {
      setError("The reader didn't answer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const canRead = !busy && (!!file || text.trim().length > 40 || /^https?:\/\//i.test(url));

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex items-center gap-2">
        <Icon name="sparkles" className="h-4 w-4 text-sky-700" />
        <h3 className="text-sm font-semibold text-slate-900">Fill from the exhibitor kit</h3>
      </div>
      <p className="text-xs text-slate-500">
        Reads the kit and fills this form&apos;s empty dates, addresses and venue, highlighted in blue. Check them
        against the kit, then Save changes. Anything already filled is left alone.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setFile(null);
          }}
          placeholder="https:// — the kit PDF or the show's shipping page"
          className={inputClass}
        />
        <button
          type="button"
          onClick={read}
          disabled={!canRead}
          className="whitespace-nowrap rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? "Reading… (up to a couple of minutes)" : "Read and fill"}
        </button>
      </div>
      <label className="block text-xs text-slate-500">
        or upload the kit PDF:{" "}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
      </label>
        <details className="text-xs text-slate-500" open={text.length > 0}>
          <summary className="cursor-pointer">or paste the text from the kit</summary>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste the shipping / material handling section — dates, warehouse and show-site addresses. Used instead of the link when filled."
            className={`${inputClass} mt-2 text-sm`}
          />
        </details>
      {error ? <p className="text-sm text-dts-maroon">{error}</p> : null}
      {done ? (
        <div className="space-y-2 text-xs">
          {done.filled.length ? (
            <div>
              <p className="font-medium text-emerald-700">
                Filled {done.filled.length} field{done.filled.length === 1 ? "" : "s"}. Not saved yet — check them, then
                Save changes.
              </p>
              <ul className="mt-1 space-y-0.5 text-slate-600">
                {done.filled.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-slate-600">
              Nothing new to fill: the kit didn&apos;t give a date or address this form is missing.
            </p>
          )}
          {done.skipped.length ? (
            <ul className="space-y-0.5 text-amber-800">
              {done.skipped.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          ) : null}
          {done.warnings.length ? (
            <ul className="space-y-0.5 text-amber-800">
              {done.warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
