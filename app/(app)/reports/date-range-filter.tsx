"use client";

import { useRouter } from "next/navigation";
import { reportQuery, type DatePreset } from "@/lib/reports";

/**
 * The period for a report: a quick pick (year to date, a quarter, last year)
 * or any two dates off the calendar. Held in the URL, so a filtered view
 * survives a refresh and can be sent to someone; the selected show stays put.
 */
export function DateRangeFilter({
  from,
  to,
  show,
  basePath,
  presets,
}: {
  from: string;
  to: string;
  show?: string;
  basePath: string;
  presets: DatePreset[];
}) {
  const router = useRouter();
  const push = (f: string, t: string) => router.push(`${basePath}${reportQuery({ show, from: f, to: t })}`);

  const field =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

  // A quick pick shows as picked only on an exact match, so moving either
  // date by hand reads "Custom" instead of mislabelling the range.
  const active = presets.find((p) => p.from === from && p.to === to)?.label ?? "";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Period</span>
        <select
          value={active}
          onChange={(e) => {
            const p = presets.find((x) => x.label === e.target.value);
            push(p?.from ?? "", p?.to ?? "");
          }}
          className={field}
        >
          <option value="">{from || to ? "Custom" : "All dates"}</option>
          {presets.map((p) => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">From</span>
        <input type="date" value={from} max={to || undefined} onChange={(e) => push(e.target.value, to)} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">To</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => push(from, e.target.value)} className={field} />
      </label>
      {from || to ? (
        <button type="button" onClick={() => push("", "")} className="px-2 py-2 text-sm font-medium text-slate-500 transition hover:text-dts-maroon">
          Clear
        </button>
      ) : null}
    </div>
  );
}
