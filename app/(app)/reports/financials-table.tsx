"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatCurrency } from "@/lib/format";

export type FinLoad = {
  id: string;
  ref: string | null;
  customerId: string | null;
  customer: string;
  billed: number;
  cost: number;
};
export type FinCarrier = {
  id: string | null;
  name: string;
  count: number;
  billed: number;
  cost: number;
  loads: FinLoad[];
};
export type FinShow = {
  id: string | null;
  name: string;
  edition: number | null;
  count: number;
  billed: number;
  cost: number;
  carriers: FinCarrier[];
};

const money = (n: number) => formatCurrency(n, { cents: true });
const marginClass = (n: number) => (n < 0 ? "text-dts-maroon" : "text-emerald-600");

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

/**
 * Financials grouped show → carrier, where each carrier row expands to the
 * individual loads behind its total (customer and load number), so a figure
 * can be traced to the shipments that produced it.
 */
export function FinancialsTable({ shows, grand }: { shows: FinShow[]; grand: { billed: number; cost: number } }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Show / Carrier</Th><Th right>Shipments</Th><Th right>Billed</Th><Th right>Cost</Th><Th right>Margin</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {shows.map((s) => {
              const showKey = s.id ?? "__none__";
              const showMargin = s.billed - s.cost;
              return (
                <Fragment key={showKey}>
                  <tr className="bg-slate-50/50">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {s.id ? (
                        <Link href={`/shows/${s.id}`} className="hover:text-dts-maroon">
                          {s.name}{s.edition ? <span className="ml-1 text-slate-400">{s.edition}</span> : null}
                        </Link>
                      ) : (
                        <span className="text-slate-500">{s.name}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{s.count}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{money(s.billed)}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{money(s.cost)}</td>
                    <td className="px-5 py-3 text-right font-semibold">
                      <span className={marginClass(showMargin)}>{money(showMargin)}</span>
                    </td>
                  </tr>
                  {s.carriers.map((c) => {
                    const key = `${showKey}-${c.id ?? "__none__"}`;
                    const isOpen = !!open[key];
                    const cm = c.billed - c.cost;
                    return (
                      <Fragment key={key}>
                        <tr className="hover:bg-slate-50/60">
                          <td className="py-2.5 pl-10 pr-5 text-slate-600">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggle(key)}
                                aria-expanded={isOpen}
                                aria-label={isOpen ? `Hide loads for ${c.name}` : `Show loads for ${c.name}`}
                                className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-dts-maroon"
                              >
                                <Icon
                                  name="chevronRight"
                                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                                />
                              </button>
                              {c.id ? (
                                <Link href={`/carriers/${c.id}`} className="hover:text-dts-maroon">{c.name}</Link>
                              ) : (
                                <span className="text-slate-400">{c.name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right text-slate-600">{c.count}</td>
                          <td className="px-5 py-2.5 text-right text-slate-600">{money(c.billed)}</td>
                          <td className="px-5 py-2.5 text-right text-slate-600">{money(c.cost)}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className={marginClass(cm)}>{money(cm)}</span>
                          </td>
                        </tr>
                        {isOpen
                          ? c.loads.map((l) => {
                              const lm = l.billed - l.cost;
                              return (
                                <tr key={l.id} className="bg-slate-50/30 text-xs">
                                  <td className="py-2 pl-[4.5rem] pr-5">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <Link href={`/shipments/${l.id}`} className="font-medium text-slate-600 hover:text-dts-maroon">
                                        {l.ref ? `#${l.ref}` : "No load #"}
                                      </Link>
                                      <span className="text-slate-300">·</span>
                                      {l.customerId ? (
                                        <Link href={`/exhibitors/${l.customerId}`} className="text-slate-500 hover:text-dts-maroon">
                                          {l.customer}
                                        </Link>
                                      ) : (
                                        <span className="text-slate-400">{l.customer}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td />
                                  <td className="px-5 py-2 text-right text-slate-500">{money(l.billed)}</td>
                                  <td className="px-5 py-2 text-right text-slate-500">{money(l.cost)}</td>
                                  <td className="px-5 py-2 text-right">
                                    <span className={marginClass(lm)}>{money(lm)}</span>
                                  </td>
                                </tr>
                              );
                            })
                          : null}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-5 py-3 font-semibold text-slate-900">Total</td>
              <td />
              <td className="px-5 py-3 text-right font-semibold text-slate-900">{money(grand.billed)}</td>
              <td className="px-5 py-3 text-right font-semibold text-slate-900">{money(grand.cost)}</td>
              <td className="px-5 py-3 text-right font-semibold">
                <span className={marginClass(grand.billed - grand.cost)}>{money(grand.billed - grand.cost)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
