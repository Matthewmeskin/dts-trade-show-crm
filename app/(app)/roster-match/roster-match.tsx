"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { salesStatusMeta, priorityTierMeta } from "@/lib/exhibitors";
import { matchRoster, recordRoster, type RosterState, type RecordState } from "./actions";

const initial: RosterState = { results: [], total: 0, matchedCount: 0, show: "", error: null };
const recordInitial: RecordState = { saved: 0, error: null };

type Filter = "all" | "matched" | "new";

export function RosterMatch({ shows }: { shows: string[] }) {
  const [state, action, pending] = useActionState(matchRoster, initial);
  const [recordState, doRecord, recording] = useActionState(recordRoster, recordInitial);
  const [text, setText] = useState("");
  const [show, setShow] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const shown = state.results.filter((r) =>
    filter === "matched" ? r.matched : filter === "new" ? !r.matched : true,
  );
  const newCount = state.total - state.matchedCount;
  const matchedIds = state.results.map((r) => r.matched?.id).filter((id): id is string => !!id);
  const returningCount = state.results.filter((r) => r.history).length;
  const hasShow = !!state.show;

  return (
    <div className="space-y-5">
      <Card>
        <form action={action} className="p-5">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label htmlFor="names" className="block text-sm font-medium text-slate-700">
                Exhibitor list
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                One company per line — paste a column from the show&rsquo;s list, or upload a .csv/.txt.
              </p>
              <textarea
                id="names"
                name="names"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={"Acme Robotics\nGlobex Corporation\nInitech LLC\n…"}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
              />
            </div>
            <div>
              <label htmlFor="show" className="block text-sm font-medium text-slate-700">
                Show <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                Set this to check who&rsquo;s shipped it before and to save the 2026 roster.
              </p>
              <input
                id="show"
                name="show"
                value={show}
                onChange={(e) => setShow(e.target.value)}
                list="known-shows"
                placeholder="e.g. FABTECH"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
              />
              <datalist id="known-shows">
                {shows.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Matching…" : "Match against customers"}
            </button>
            <label className="cursor-pointer text-sm font-medium text-dts-maroon hover:underline">
              Upload .csv/.txt
              <input type="file" accept=".csv,.txt,.tsv,text/plain,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {text.trim() ? (
              <button type="button" onClick={() => setText("")} className="text-sm font-medium text-slate-400 hover:text-slate-700">
                Clear
              </button>
            ) : null}
          </div>
          {state.error ? (
            <p className="mt-3 rounded-lg bg-dts-maroon/5 px-3 py-2 text-sm text-dts-maroon">{state.error}</p>
          ) : null}
        </form>
      </Card>

      {state.total > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{state.matchedCount}</span> of{" "}
              <span className="font-semibold text-slate-900">{state.total}</span> are existing customers
              <span className="text-slate-400"> · {newCount} new prospect{newCount === 1 ? "" : "s"}</span>
              {hasShow ? (
                <span className="text-slate-400">
                  {" "}
                  · <span className="font-semibold text-slate-700">{returningCount}</span> shipped {state.show} before
                </span>
              ) : null}
            </div>
            <div className="flex gap-1 text-sm">
              {(["all", "matched", "new"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1 font-medium transition ${
                    filter === f ? "bg-dts-maroon text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {f === "matched" ? "Customers" : f === "new" ? "New" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Save-to-roster */}
          {hasShow && matchedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <form action={doRecord}>
                <input type="hidden" name="show" value={state.show} />
                <input type="hidden" name="ids" value={matchedIds.join(",")} />
                <button
                  type="submit"
                  disabled={recording}
                  className="rounded-lg border border-dts-maroon px-3 py-1.5 text-sm font-medium text-dts-maroon transition hover:bg-dts-maroon hover:text-white disabled:opacity-60"
                >
                  {recording ? "Saving…" : `Save ${matchedIds.length} customers as ${state.show} 2026 roster`}
                </button>
              </form>
              {recordState.saved > 0 ? (
                <span className="text-sm font-medium text-emerald-600">
                  ✓ Saved — {state.show} now shows these as confirmed for 2026 in Show History.
                </span>
              ) : null}
              {recordState.error ? <span className="text-sm text-dts-maroon">{recordState.error}</span> : null}
              <span className="text-xs text-slate-400">New prospects aren&rsquo;t saved (add them as exhibitors first).</span>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">From list</th>
                  <th className="px-5 py-3">Match</th>
                  {hasShow ? <th className="px-5 py-3">Shipped {state.show}?</th> : null}
                  <th className="px-5 py-3">Owner / rep</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3 text-right">Lifetime margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shown.map((r, i) => {
                  const m = r.matched;
                  const sm = salesStatusMeta(m?.sales_status);
                  const tm = priorityTierMeta(m?.priority_tier);
                  return (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 text-slate-700">{r.input}</td>
                      <td className="px-5 py-3">
                        {m ? (
                          <Link href={`/exhibitors/${m.id}`} className="font-medium text-dts-maroon hover:underline">
                            {m.company_name}
                          </Link>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">New prospect</span>
                        )}
                      </td>
                      {hasShow ? (
                        <td className="px-5 py-3 text-xs">
                          {r.history ? (
                            <span className="font-medium text-emerald-600">
                              ✓ {r.history.loads} loads
                              {r.history.first ? (
                                <span className="font-normal text-slate-400">
                                  {" "}
                                  ({r.history.first === r.history.last ? r.history.first : `${r.history.first}–${r.history.last}`})
                                </span>
                              ) : null}
                            </span>
                          ) : m ? (
                            <span className="text-dts-blue">New to show</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-5 py-3 text-slate-600">{m?.owner_rep ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3">
                        {sm ? (
                          <Badge className={sm.badge}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                            {sm.label}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {tm ? <Badge className={tm.badge}>{tm.label}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {m?.legacy_margin != null ? formatCurrency(m.legacy_margin) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
