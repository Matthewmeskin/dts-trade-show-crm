import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageParam } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("venues").select("*").order("venue_name");
  if (q.trim()) query = query.ilike("venue_name", `%${q.trim()}%`);

  const [{ data: venues }, { data: shows }, ships] = await Promise.all([
    query,
    supabase.from("shows").select("venue_id"),
    // Count loads across the full shipments table — page past the 1,000-row cap.
    fetchAll<{ venue_id: string | null }>(() => supabase.from("shipments").select("venue_id")),
  ]);

  const showCount = new Map<string, number>();
  for (const s of shows ?? []) {
    if (s.venue_id) showCount.set(s.venue_id, (showCount.get(s.venue_id) ?? 0) + 1);
  }
  const loadCount = new Map<string, number>();
  for (const s of ships ?? []) {
    if (s.venue_id) loadCount.set(s.venue_id, (loadCount.get(s.venue_id) ?? 0) + 1);
  }
  const rows = venues ?? [];

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    return `/venues${params.toString() ? `?${params}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Venues"
        description="Reusable venue records — intel accumulates across shows."
        actions={
          <Link
            href="/venues/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New venue
          </Link>
        }
      />

      <div className="mb-4 flex justify-end">
        <form>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search venues…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="venues"
            title={q ? "No venues match" : "No venues yet"}
            description={q ? "Try a different search." : "Add your first venue to start building intel."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Venue</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Loads</th>
                  <th className="px-5 py-3">Shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedRows.map((v) => (
                  <LinkRow key={v.id} href={`/venues/${v.id}`} className="group hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/venues/${v.id}`}
                        className="font-medium text-slate-900 group-hover:text-dts-maroon"
                      >
                        {v.venue_name}
                      </Link>
                      {v.address ? (
                        <div className="text-xs text-slate-400">{v.address}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {[v.city, v.state].filter(Boolean).join(", ") || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {loadCount.get(v.id) ?? 0}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {showCount.get(v.id) ?? 0}
                    </td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} makeHref={pageHref} />
          </div>
        )}
      </Card>
    </div>
  );
}
