"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { quickAddShow, type QuickShowState } from "../actions";

const field =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

/**
 * Add a show without leaving the sales calendar. Name and start date are all
 * the calendar needs; the rest lives on the show's own page.
 */
export function QuickAddShow({ ownerOptions }: { ownerOptions: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<QuickShowState, FormData>(quickAddShow, { error: null });
  const form = useRef<HTMLFormElement>(null);
  const [start, setStart] = useState("");

  // Clear the form after a successful add, ready for the next one.
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-dts-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-dts-maroon-dark"
      >
        + Add show
      </button>
    );
  }

  return (
    <form
      ref={form}
      action={action}
      onSubmit={() => setStart("")}
      className="mb-4 flex w-full flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3"
    >
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Show name
        <input name="show_name" required autoFocus placeholder="e.g. SEMA Show" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Starts
        <input name="show_start_date" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Ends
        <input name="show_end_date" type="date" min={start || undefined} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Industry
        <input name="industry_vertical" placeholder="optional" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Lead gen
        <input name="lead_gen_owner" list="quick-add-owners" placeholder="optional" className={`${field} w-28`} />
        <datalist id="quick-add-owners">
          {ownerOptions.map((o) => <option key={o} value={o} />)}
        </datalist>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-dts-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-dts-maroon-dark disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800">
        Done
      </button>
      {state.error ? <p className="basis-full text-sm text-dts-maroon">{state.error}</p> : null}
      {state.ok ? <p className="basis-full text-sm text-emerald-700">{state.ok} It&apos;s in the list below.</p> : null}
    </form>
  );
}
