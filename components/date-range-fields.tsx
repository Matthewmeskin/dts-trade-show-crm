/**
 * Two date inputs (from / to) for a GET filter form. Server component — the
 * values submit with the surrounding <form>; pages read `from`/`to` params.
 */
export function DateRangeFields({
  from,
  to,
  label = "Date",
}: {
  from?: string;
  to?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600">
      <span className="text-xs text-slate-400">{label}</span>
      <input type="date" name="from" defaultValue={from ?? ""} aria-label="From date" className="bg-transparent text-sm outline-none" />
      <span className="text-slate-300">–</span>
      <input type="date" name="to" defaultValue={to ?? ""} aria-label="To date" className="bg-transparent text-sm outline-none" />
    </span>
  );
}
