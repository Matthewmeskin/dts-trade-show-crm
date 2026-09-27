"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/form";
import { Card, CardHeader } from "@/components/ui";
import { encodeKitFacts, kitFillForShow, type KitFill, type KitReading } from "@/lib/kit-reader";
import { applyKitToShow, type LogisticsState } from "../logistics-actions";

/**
 * On the Overview, while the show is missing its dates or freight addresses:
 * read the exhibitor kit, see exactly what it would add (each value with where
 * the kit says it), and add it to the show in one click. Only empty fields are
 * filled; nothing publishes until someone Verifies the Show page tab.
 */
export function OverviewKitFill({
  showId,
  defaultUrl,
  current,
}: {
  showId: string;
  defaultUrl: string | null;
  /** The show's columns as saved, so the preview matches what will be added. */
  current: Record<string, unknown>;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<{ reading: KitReading; fill: KitFill; kitUrl: string | null } | null>(null);
  const [state, action] = useActionState(applyKitToShow, { error: null } as LogisticsState);

  async function readKit() {
    setBusy(true);
    setError(null);
    setRead(null);
    const fd = new FormData();
    fd.set("show_id", showId);
    if (file) fd.set("file", file);
    else fd.set("url", url);
    try {
      const res = await fetch("/api/read-kit", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!body?.ok) {
        setError(body?.error ?? "The reader failed. Try again.");
        return;
      }
      const reading = body.reading as KitReading;
      setRead({ reading, fill: kitFillForShow(reading.facts, current), kitUrl: file ? null : url });
    } catch {
      setError("The reader didn't answer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const toAdd = read ? Object.fromEntries(read.fill.filled.map((f) => [f.field, read.reading.facts[f.field]!])) : {};

  return (
    <Card className="border-sky-200">
      <CardHeader title="Fill the dates and addresses from the exhibitor kit" icon="sparkles" />
      <div className="space-y-3 p-5 text-sm">
        <p className="text-xs text-slate-500">
          This show is missing dates or a freight address. Paste the kit link (or upload the PDF), read it, check what it
          found, then add it. Only empty fields are filled.
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
            onClick={readKit}
            disabled={busy || (!file && !/^https?:\/\//i.test(url))}
            className="whitespace-nowrap rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {busy ? "Reading… (up to a couple of minutes)" : "Read the kit"}
          </button>
        </div>
        <label className="block text-xs text-slate-500">
          or upload the kit PDF:{" "}
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        </label>
        {error ? <p className="text-dts-maroon">{error}</p> : null}

        {read ? (
          <div className="space-y-3">
            {read.fill.filled.length ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs">
                {read.fill.filled.map((f) => (
                  <li key={f.field} className="grid gap-1 p-2.5 sm:grid-cols-[12rem_1fr]">
                    <span className="font-medium text-slate-600">{f.label}</span>
                    <span>
                      <span className="block text-slate-900">{f.value}</span>
                      {f.where ? <span className="block text-slate-400">{f.where}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600">The kit didn&apos;t give any date or address this show is missing.</p>
            )}
            {read.fill.skipped.length ? (
              <ul className="space-y-0.5 text-xs text-amber-800">
                {read.fill.skipped.map((s) => (
                  <li key={s.label}>
                    · {s.label}: {s.value} — {s.why}
                  </li>
                ))}
              </ul>
            ) : null}
            {read.reading.warnings.length ? (
              <ul className="space-y-0.5 text-xs text-amber-800">
                {read.reading.warnings.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            ) : null}
            {read.fill.filled.length ? (
              <form action={action} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="show_id" value={showId} />
                <input type="hidden" name="facts" value={encodeKitFacts(toAdd)} />
                <input type="hidden" name="kit_url" value={read.kitUrl ?? ""} />
                <button type="submit" className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark">
                  Add these {read.fill.filled.length} to the show
                </button>
                <span className="text-xs text-slate-400">Checked them against the kit? Nothing publishes until Verify.</span>
              </form>
            ) : null}
          </div>
        ) : null}
        {state.error ? <p className="text-dts-maroon">{state.error}</p> : null}
        {state.ok ? <p className="text-emerald-700">{state.message}</p> : null}
      </div>
    </Card>
  );
}
