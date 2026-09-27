"use client";

import { useState } from "react";
import { inputClass } from "@/components/form";
import { Icon } from "@/components/icons";
import {
  FIELD_LABELS,
  compareFacts,
  encodeKitFacts,
  type KitLogisticsField,
  type KitReading,
  type KitShowFact,
} from "@/lib/kit-reader";

/** What happened to one field when the reading was applied to the form. */
export type FillResult = {
  field: KitLogisticsField;
  value: string;
  where: string;
  /** filled: was empty, now holds the kit's value. same: already matched. kept: you had something else. */
  outcome: "filled" | "same" | "kept";
  current: string;
};

type Props = {
  showId: string;
  showYear: number | null;
  defaultUrl: string | null;
  crmFacts: Partial<Record<KitShowFact, string | null>>;
  /** Puts the reading into the form and reports what it did with each value. */
  onRead: (reading: KitReading, url: string | null) => FillResult[];
  /** Overwrite one field you had with the kit's value. */
  onUseKit: (field: KitLogisticsField, value: string) => void;
};

type Mode = "url" | "file" | "text";

export function KitReaderPanel({ showId, showYear, defaultUrl, crmFacts, onRead, onUseKit }: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reading: KitReading; fills: FillResult[] } | null>(null);

  async function read() {
    setBusy(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("show_id", showId);
    if (mode === "url") fd.set("url", url);
    if (mode === "text") fd.set("text", text);
    if (mode === "file" && file) fd.set("file", file);
    try {
      const res = await fetch("/api/read-kit", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!body?.ok) {
        setError(body?.error ?? (res.status === 413 ? "That PDF is too big to upload here — paste the link to it instead." : "The reader failed. Try again."));
        return;
      }
      const reading = body.reading as KitReading;
      const fills = onRead(reading, mode === "url" ? url : null);
      setResult({ reading, fills });
    } catch {
      setError("The reader didn't answer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const canRead =
    !busy && ((mode === "url" && /^https?:\/\//i.test(url)) || (mode === "text" && text.trim().length > 40) || (mode === "file" && !!file));

  const facts = result ? compareFacts(result.reading.facts, crmFacts) : [];
  // The kit's dates and addresses the show record doesn't have yet.
  const missing = facts.filter((f) => f.status === "missing");
  const missingFacts = missing.length
    ? Object.fromEntries(missing.map((f) => [f.field, result!.reading.facts[f.field]!]))
    : null;
  const filled = result?.fills.filter((f) => f.outcome === "filled").length ?? 0;
  const wrongYear =
    result?.reading.kit_year && showYear && !result.reading.kit_year.includes(String(showYear))
      ? result.reading.kit_year
      : null;

  return (
    <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
      <div className="flex items-start gap-2">
        <Icon name="sparkles" className="mt-0.5 h-4 w-4 text-sky-700" />
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Draft from the exhibitor kit</h4>
          <p className="text-xs text-slate-500">
            The reader fills the empty fields below from the kit and shows where it found each one. It saves
            nothing and never verifies — you check each line against the kit, then Save draft.
          </p>
        </div>
      </div>

      <div className="flex gap-1 text-xs">
        {(
          [
            ["url", "Kit link"],
            ["file", "Upload PDF"],
            ["text", "Paste text"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-2.5 py-1 font-medium ${mode === m ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "url" ? (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https:// — the kit PDF or the show's shipping page"
          className={inputClass}
          aria-label="Exhibitor kit link"
        />
      ) : mode === "file" ? (
        <div className="space-y-1">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-200"
            aria-label="Exhibitor kit PDF"
          />
          <p className="text-xs text-slate-400">
            Up to about 4 MB. For a bigger manual paste its link, or upload just the shipping pages.
          </p>
        </div>
      ) : (
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the shipping / material handling section of the kit"
          className={inputClass}
          aria-label="Exhibitor kit text"
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={read}
          disabled={!canRead}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? "Reading the kit… (up to a couple of minutes)" : "Read the kit"}
        </button>
        {error ? <span className="text-sm text-dts-maroon">{error}</span> : null}
      </div>

      {result ? (
        <div className="space-y-4 border-t border-sky-100 pt-4">
          <p className="text-sm text-slate-700">
            {filled
              ? `Filled ${filled} field${filled === 1 ? "" : "s"} below — not saved yet.`
              : "Nothing new to fill in on this tab."}{" "}
            Check each against the kit, fix anything that&apos;s off, then Save draft.
          </p>

          {wrongYear || result.reading.warnings.length ? (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {wrongYear ? (
                <li>
                  <strong>This kit says {wrongYear}</strong>, and this edition is {showYear}. Don&apos;t use it unless
                  you&apos;re sure the dates carry over.
                </li>
              ) : null}
              {result.reading.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {result.fills.length ? (
            <div>
              <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                This tab — check each line
              </h5>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs">
                {result.fills.map((f) => (
                  <li key={f.field} className="grid gap-1 p-2.5 sm:grid-cols-[11rem_1fr]">
                    <span className="font-medium text-slate-600">{FIELD_LABELS[f.field]}</span>
                    <span className="space-y-0.5">
                      <span className="block text-slate-900">{display(f.field, f.value)}</span>
                      {f.where ? <span className="block text-slate-400">Kit: {f.where}</span> : null}
                      {f.outcome === "kept" ? (
                        <span className="flex flex-wrap items-center gap-2 text-amber-700">
                          You already had &ldquo;{display(f.field, f.current)}&rdquo; — kept yours.
                          <button
                            type="button"
                            onClick={() => {
                              onUseKit(f.field, f.value);
                              setResult((r) =>
                                r && {
                                  ...r,
                                  fills: r.fills.map((x) => (x.field === f.field ? { ...x, outcome: "filled", current: "" } : x)),
                                },
                              );
                            }}
                            className="font-medium text-sky-700 underline-offset-2 hover:underline"
                          >
                            Use the kit&apos;s
                          </button>
                        </span>
                      ) : f.outcome === "same" ? (
                        <span className="block text-emerald-700">Matches what you had.</span>
                      ) : (
                        <span className="block text-sky-700">Filled in from the kit.</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {facts.length ? (
            <div>
              <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dates and addresses — compare with the Overview tab
              </h5>
              <p className="mb-1.5 text-xs text-slate-400">
                These live on the show record, so the reader doesn&apos;t change them here.
              </p>
              {missingFacts ? (
                <a
                  href={`/shows/${showId}/edit?kit=${encodeURIComponent(encodeKitFacts(missingFacts))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3 py-1.5 text-xs font-medium text-white hover:bg-dts-maroon-dark"
                >
                  Put the {Object.keys(missingFacts).length} missing on the show&apos;s edit form ↗
                </a>
              ) : null}
              {missingFacts ? (
                <p className="mb-2 text-xs text-slate-400">
                  Opens in a new tab with only the empty fields filled in; you check them and save there. Save this
                  tab&apos;s draft too.
                </p>
              ) : null}
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs">
                {facts.map((f) => (
                  <li key={f.field} className="grid gap-1 p-2.5 sm:grid-cols-[11rem_1fr]">
                    <span className="font-medium text-slate-600">{f.label}</span>
                    <span className="space-y-0.5">
                      <span className="block text-slate-900">Kit: {f.kit}</span>
                      {f.where ? <span className="block text-slate-400">{f.where}</span> : null}
                      <span
                        className={`block ${f.status === "same" ? "text-emerald-700" : f.status === "differs" ? "font-medium text-dts-maroon" : "text-amber-700"}`}
                      >
                        {f.status === "same"
                          ? "Matches the show record."
                          : f.status === "differs"
                            ? `Show record says: ${f.crm}`
                            : "Not on the show record yet."}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function display(field: KitLogisticsField, value: string) {
  if (field === "targeted_move_in") return value === "yes" ? "Yes" : value === "no" ? "No" : value;
  return value;
}
