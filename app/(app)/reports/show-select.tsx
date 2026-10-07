"use client";

import { useRouter } from "next/navigation";
import { reportQuery } from "@/lib/reports";

type Opt = { id: string; label: string };

/** Show picker for scoped reports: navigates to ?show=<id>, keeping the period. */
export function ShowSelect({
  shows,
  value,
  basePath,
  from,
  to,
}: {
  shows: Opt[];
  value: string;
  basePath: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => {
        const id = e.target.value;
        router.push(`${basePath}${reportQuery({ show: id, from, to })}`);
      }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
    >
      <option value="">Select a show…</option>
      {shows.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
}
