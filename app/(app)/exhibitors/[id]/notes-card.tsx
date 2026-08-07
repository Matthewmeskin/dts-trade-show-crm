"use client";

import { useActionState, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { inputClass } from "@/components/form";
import { STATUS_REASON_OPTIONS } from "@/lib/exhibitors";
import { updateExhibitorNotes, type NotesState } from "../actions";

const initial: NotesState = { ok: false, error: null };

/**
 * Inline notes editor on the exhibitor page — a quick place to record context
 * like why we are (or aren't) doing business with them. Freight-profile notes
 * are read-only here (edited on the full form).
 */
export function ExhibitorNotesCard({
  exhibitorId,
  freightNotes,
  initialNotes,
  initialReason,
}: {
  exhibitorId: string;
  freightNotes: string | null;
  initialNotes: string;
  initialReason: string;
}) {
  const [state, action, pending] = useActionState(updateExhibitorNotes, initial);
  const [notes, setNotes] = useState(initialNotes);
  const [reason, setReason] = useState(initialReason);
  const dirty = notes !== initialNotes || reason !== initialReason;

  return (
    <Card>
      <CardHeader title="Notes" icon="documents" />
      <form action={action} className="space-y-4 p-5 text-sm">
        <input type="hidden" name="id" value={exhibitorId} />

        {freightNotes ? (
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Freight profile
            </div>
            <p className="whitespace-pre-wrap text-slate-700">{freightNotes}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="status_reason" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Status reason
          </label>
          <select
            id="status_reason"
            name="status_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {STATUS_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="general_notes" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            General
          </label>
          <textarea
            id="general_notes"
            name="general_notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Went with a competitor in 2024 on price — revisit after Q2. Or: bad payment history, do not extend terms."
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save notes"}
          </button>
          {state.ok && !dirty ? <span className="text-sm font-medium text-emerald-600">Saved ✓</span> : null}
          {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
        </div>
      </form>
    </Card>
  );
}
