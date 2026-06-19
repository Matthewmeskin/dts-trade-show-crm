import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ExhibitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; industry?: string }>;
}) {
  const { q = "", industry = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("exhibitors").select("*").order("company_name");
  if (q.trim()) query = query.ilike("company_name", `%${q.trim()}%`);
  if (industry.trim()) query = query.eq("industry", industry);

  const [{ data: exhibitors }, { data: links }, { data: ships }, { data: allForFilter }] =
    await Promise.all([
      query,
      supabase.from("show_exhibitors").select("exhibitor_id, show_id"),
      supabase.from("shipments").select("exhibitor_id, show_id"),
      supabase.from("exhibitors").select("industry"),
    ]);

  // Shows = distinct shows from manual links AND shipment show links.
  const showSets = new Map<string, Set<string>>();
  const loadCount = new Map<string, number>();
  const addShow = (eid: string | null, sid: string | null) => {
    if (!eid || !sid) return;
    const set = showSets.get(eid) ?? new Set<string>();
    set.add(sid);
    showSets.set(eid, set);
  };
  for (const l of links ?? []) addShow(l.exhibitor_id, l.show_id);
  for (const s of ships ?? []) {
    addShow(s.exhibitor_id, s.show_id);
    if (s.exhibitor_id) loadCount.set(s.exhibitor_id, (loadCount.get(s.exhibitor_id) ?? 0) + 1);
  }
  const industries = [
    ...new Set((allForFilter ?? []).map((e) => e.industry).filter(Boolean)),
  ].sort() as string[];

  const rows = exhibitors ?? [];

  return (
    <div>
      <PageHeader
        title="Exhibitors"
        description="Directory of every exhibitor across your shows."
        actions={
          <Link
            href="/exhibitors/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New exhibitor
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <form className="flex items-center gap-2">
          <select
            name="industry"
            defaultValue={industry}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          >
            <option value="">All industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search companies…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Filter
          </button>
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="exhibitors"
            title={q || industry ? "No exhibitors match" : "No exhibitors yet"}
            description={
              q || industry
                ? "Try a different search or filter."
                : "Add your first exhibitor to the directory."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Industry</th>
                  <th className="px-5 py-3">Primary contact</th>
                  <th className="px-5 py-3">Loads</th>
                  <th className="px-5 py-3">Shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((e) => (
                  <LinkRow key={e.id} href={`/exhibitors/${e.id}`} className="group hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/exhibitors/${e.id}`}
                        className="font-medium text-slate-900 group-hover:text-dts-maroon"
                      >
                        {e.company_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {e.industry ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {e.primary_contact_name ? (
                        <>
                          {e.primary_contact_name}
                          {e.primary_contact_title ? (
                            <span className="text-slate-400"> · {e.primary_contact_title}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {loadCount.get(e.id) ?? 0}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {showSets.get(e.id)?.size ?? 0}
                    </td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
