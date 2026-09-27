"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { SubmitButton, inputClass } from "@/components/form";
import { addPartnerClient, saveReportSettings, searchExhibitors, type PartnerState } from "../actions";

const small = inputClass.replace("py-2", "py-1.5");

/**
 * Link one of the partner's clients. Search the exhibitors already in the CRM
 * first; only if they aren't there, add them as a new exhibitor - so the same
 * company doesn't land in the directory twice.
 */
export function AddClientForm({ partnerId }: { partnerId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, action] = useActionState(async (prev: PartnerState, fd: FormData) => {
    const r = await addPartnerClient(prev, fd);
    if (r.ok) {
      setQ("");
      setResults([]);
      setPicked(null);
    }
    return r;
  }, { error: null } as PartnerState);

  function onType(v: string) {
    setQ(v);
    setPicked(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startSearch(async () => setResults(v.trim().length >= 2 ? await searchExhibitors(v) : []));
    }, 250);
  }

  const exact = results.some((r) => r.name.trim().toLowerCase() === q.trim().toLowerCase());

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="exhibitor_id" value={picked?.id ?? ""} />
      <input type="hidden" name="new_company_name" value={!picked && q.trim().length >= 2 && !exact ? q.trim() : ""} />
      <input
        value={picked ? picked.name : q}
        onChange={(e) => onType(e.target.value)}
        placeholder="Search exhibitors to add a client…"
        className={small}
        aria-label="Client exhibitor"
      />
      {!picked && q.trim().length >= 2 ? (
        <ul className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white text-sm">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setPicked(r);
                  setResults([]);
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
              >
                {r.name}
              </button>
            </li>
          ))}
          {searching ? <li className="px-3 py-1.5 text-xs text-slate-400">Searching…</li> : null}
          {!searching && !exact ? (
            <li className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              Not in the CRM? Pressing Add creates <strong>{q.trim()}</strong> as a new exhibitor.
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" name="in_pilot" className="h-4 w-4 accent-dts-maroon" />
          In the pilot
        </label>
        <SubmitButton pendingLabel="Adding…">Add client</SubmitButton>
        {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-600">Added.</span> : null}
      </div>
    </form>
  );
}

export function ReportSettingsForm({
  partnerId,
  reportTo,
  active,
}: {
  partnerId: string;
  reportTo: string | null;
  active: boolean;
}) {
  const [state, action] = useActionState(saveReportSettings, { error: null } as PartnerState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input
        name="report_to"
        defaultValue={reportTo ?? ""}
        placeholder="Who gets it — name@partner.com, …"
        className={small}
        aria-label="Report recipients"
      />
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        <input type="checkbox" name="report_active" defaultChecked={active} className="h-4 w-4 accent-dts-maroon" />
        Send weekly (puts it on the worklist every Monday)
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-600">Saved.</span> : null}
      </div>
    </form>
  );
}
