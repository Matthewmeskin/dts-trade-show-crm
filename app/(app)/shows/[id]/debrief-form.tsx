"use client";

import { useActionState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { saveDebrief, type DebriefState } from "../actions";
import type { Tables } from "@/lib/database.types";

export function DebriefForm({
  showId,
  debrief,
}: {
  showId: string;
  debrief: Tables<"show_debriefs"> | null;
}) {
  const [state, action] = useActionState<DebriefState, FormData>(saveDebrief, {
    error: null,
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="show_id" value={showId} />
      {debrief ? <input type="hidden" name="debrief_id" value={debrief.id} /> : null}

      <Field label="What went well" htmlFor="what_went_well">
        <textarea id="what_went_well" name="what_went_well" rows={3} defaultValue={debrief?.what_went_well ?? ""} className={inputClass} />
      </Field>
      <Field label="What went wrong" htmlFor="what_went_wrong">
        <textarea id="what_went_wrong" name="what_went_wrong" rows={3} defaultValue={debrief?.what_went_wrong ?? ""} className={inputClass} />
      </Field>
      <Field label="Carrier performance notes" htmlFor="carrier_performance_notes">
        <textarea id="carrier_performance_notes" name="carrier_performance_notes" rows={3} defaultValue={debrief?.carrier_performance_notes ?? ""} className={inputClass} />
      </Field>
      <Field label="Venue issues" htmlFor="venue_issues">
        <textarea id="venue_issues" name="venue_issues" rows={3} defaultValue={debrief?.venue_issues ?? ""} className={inputClass} />
      </Field>
      <Field label="Recommendations for next year" htmlFor="recommendations_next_year">
        <textarea id="recommendations_next_year" name="recommendations_next_year" rows={3} defaultValue={debrief?.recommendations_next_year ?? ""} className={inputClass} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">
          {debrief ? "Update debrief" : "Save debrief"}
        </SubmitButton>
        {state.ok ? <span className="text-sm text-emerald-600">Saved.</span> : null}
        {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
      </div>
    </form>
  );
}
