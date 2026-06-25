"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { mergeRecords } from "@/app/(app)/merge-actions";

/**
 * Merge a duplicate record into this one. Pick the duplicate from the list; on
 * confirm it reassigns the duplicate's links here, fills any gaps, and deletes
 * it (server action redirects back to this kept record).
 */
export function MergeButton({
  kind,
  targetId,
  targetLabel,
  candidates,
}: {
  kind: "venue" | "show";
  targetId: string;
  targetLabel: string;
  candidates: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");

  const others = candidates.filter((c) => c.id !== targetId);
  const sourceLabel = others.find((c) => c.id === source)?.label ?? "the selected record";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Icon name="venues" className="h-4 w-4" /> Merge duplicate
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
              <form
                action={mergeRecords}
                onClick={(e) => e.stopPropagation()}
                onSubmit={(e) => {
                  if (!source || !window.confirm(`Merge "${sourceLabel}" into "${targetLabel}"? Everything linked to it moves here and the duplicate is deleted. This can't be undone.`)) {
                    e.preventDefault();
                  }
                }}
                className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
              >
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="target_id" value={targetId} />
                <h2 className="font-heading text-lg font-semibold text-slate-900">Merge a duplicate {kind}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pick the duplicate to merge <span className="font-medium text-slate-700">into {targetLabel}</span>. Its
                  shipments, shows, and notes move here; the duplicate is deleted.
                </p>
                <select
                  name="source_id"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  required
                  className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
                >
                  <option value="">— Select the duplicate to merge in —</option>
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">Cancel</button>
                  <button type="submit" disabled={!source} className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60">
                    Merge in
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
