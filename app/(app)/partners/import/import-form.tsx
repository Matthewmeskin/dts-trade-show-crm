"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { SubmitButton, inputClass } from "@/components/form";
import { PARTNER_TYPES, labelOf, parseImport } from "@/lib/partners";
import { importPartners, type PartnerState } from "../actions";

const EXAMPLE = `Company\tType\tTier\tWebsite\tCity\tState\tClients\tNotes
Example Exhibits (sample)\tExhibit builder\t1\texample.com\tAnaheim\tCA\t25\tSample row - delete before importing`;

export function ImportForm({ people, me }: { people: { id: string; name: string }[]; me: string }) {
  const [state, action] = useActionState(importPartners, { error: null } as PartnerState);
  const [text, setText] = useState("");
  const preview = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form action={action} className="space-y-4">
        <Card className="space-y-3 p-5">
          <textarea
            name="sheet"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            className={`${inputClass} font-mono text-xs`}
            aria-label="Pasted sheet"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Sales admin for these</span>
              <select name="admin_id" defaultValue={me} className={inputClass}>
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Source (if the sheet has none)</span>
              <input name="source" placeholder="e.g. EDPA member list 2026" className={inputClass} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Importing…">
              Import {preview?.rows.length ? `${preview.rows.length} partner${preview.rows.length === 1 ? "" : "s"}` : ""}
            </SubmitButton>
            {state.ok ? (
              <span className="text-sm text-emerald-600">
                {state.message}{" "}
                <Link href="/partners" className="font-medium underline">
                  See the list
                </Link>
              </span>
            ) : null}
            {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
          </div>
          {state.problems?.length ? (
            <ul className="list-disc pl-5 text-xs text-amber-800">
              {state.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        {preview ? (
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Preview — {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"}
            </h3>
            {preview.problems.length ? (
              <ul className="mb-3 list-disc pl-5 text-xs text-amber-800">
                {preview.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left uppercase tracking-wide text-slate-400">
                    <th className="py-1.5 pr-3">Company</th>
                    <th className="py-1.5 pr-3">Type</th>
                    <th className="py-1.5 pr-3">Tier</th>
                    <th className="py-1.5 pr-3">Clients</th>
                    <th className="py-1.5 pr-3">Location</th>
                    <th className="py-1.5">Website</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {preview.rows.slice(0, 300).map((r) => (
                    <tr key={r.name}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{r.name}</td>
                      <td className="py-1.5 pr-3">{labelOf(PARTNER_TYPES, r.partner_type)}</td>
                      <td className="py-1.5 pr-3">{r.tier ?? "—"}</td>
                      <td className="py-1.5 pr-3">{r.client_count ?? "—"}</td>
                      <td className="py-1.5 pr-3">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="py-1.5">{r.website ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </form>

      <Card className="h-fit space-y-2 p-5 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-900">How it reads the sheet</h3>
        <p>First row is the header. Tabs (pasted from a spreadsheet) or commas both work.</p>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>
            <strong>Company</strong> (or Name) — required
          </li>
          <li>
            <strong>Type</strong> — builder / exhibit house, GSC, organizer, I&amp;D / agency
          </li>
          <li>
            <strong>Tier</strong> — 1, 2 or 3
          </li>
          <li>
            <strong>Clients</strong> — exhibitors they control freight for
          </li>
          <li>Website, City, State, Source, Notes</li>
        </ul>
        <p className="text-xs text-slate-400">
          Companies already on the list are skipped, never overwritten. Link each partner&apos;s shows from their page after
          importing.
        </p>
      </Card>
    </div>
  );
}
