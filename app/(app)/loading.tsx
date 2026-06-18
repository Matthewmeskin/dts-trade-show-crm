/**
 * Shown instantly while a page segment server-renders, so navigation feels
 * immediate instead of frozen. Generic enough to read well for both list and
 * record pages.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 h-7 w-48 rounded-md bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>

      {/* Card with rows */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <div className="h-4 w-32 rounded bg-slate-100" />
        </div>
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-4 w-20 rounded-full bg-slate-100" />
              <div className="ml-auto h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
