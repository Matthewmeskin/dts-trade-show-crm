"use client";

import { useRouter } from "next/navigation";
import type { DatePreset } from "@/lib/reports";

/**
 * From/to range for a report, held in the URL so a filtered view is shareable
 * and survives a refresh. Either end may be left blank for an open-ended range.
 */
export function DateRangeFilter({
  from,
  to,
  basePath,
  presets,
}: {
  from: string;
  to: string;
  basePath: string;
  presets: DatePreset[];
}) {
  const router = useRouter();

  const push = (nextFrom: string, nextTo: string) => {
    const q = new URLSearchParams();
    if (nextFrom) q.set("from", nextFrom);
    if (nextTo) q.set("to", nextTo);
    const s = q.toString();
    router.push(s ? `${basePath}?${s}` : basePath);
  };

  const field =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

  // A preset is "active" only on an exact match, so nudging either date by
  // hand drops the picker back to Custom rather than mislabelling the range.
  const active = presets.find((p) => p.from === from && p.to === to)?.label ?? "";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Period</span>
        <select
          value={active}
          onChange={(e) => {
            const preset = presets.find((p) => p.label === e.target.value);
            push(preset?.from ?? "", preset?.to ?? "");
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
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => push(e.target.value, to)}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">To</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => push(from, e.target.value)}
          className={field}
        />
      </label>
      {from || to ? (
        <button
          type="button"
          onClick={() => push("", "")}
          className="px-2 py-2 text-sm font-medium text-slate-500 transition hover:text-dts-maroon"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
