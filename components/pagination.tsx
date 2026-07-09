import Link from "next/link";

/**
 * Table pagination footer. Server component — pass a `makeHref` that builds the
 * URL for a given page (preserving the current filters).
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  makeHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const btn =
    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100";
  const disabled = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-300";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
      <span className="text-sm text-slate-500">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={makeHref(page - 1)} className={btn} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={disabled}>Previous</span>
        )}
        <span className="px-1 text-sm text-slate-400">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={makeHref(page + 1)} className={btn} rel="next">
            Next
          </Link>
        ) : (
          <span className={disabled}>Next</span>
        )}
      </div>
    </div>
  );
}
