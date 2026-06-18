import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("carriers").select("*").order("carrier_name");
  if (q.trim()) query = query.ilike("carrier_name", `%${q.trim()}%`);

  const [{ data: carriers }, { data: cv }, { data: ships }] = await Promise.all([
    query,
    supabase.from("carrier_venues").select("carrier_id"),
    supabase.from("shipments").select("carrier_id"),
  ]);

  const venueCount = new Map<string, number>();
  for (const r of cv ?? []) venueCount.set(r.carrier_id, (venueCount.get(r.carrier_id) ?? 0) + 1);
  const shipCount = new Map<string, number>();
  for (const r of ships ?? []) {
    if (r.carrier_id) shipCount.set(r.carrier_id, (shipCount.get(r.carrier_id) ?? 0) + 1);
  }
  const rows = carriers ?? [];

  return (
    <div>
      <PageHeader
        title="Carriers"
        description="Carrier directory — trade show intel and shipment history."
        actions={
          <Link
            href="/carriers/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New carrier
          </Link>
        }
      />

      <div className="mb-4 flex justify-end">
        <form>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search carriers…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="carriers"
            title={q ? "No carriers match" : "No carriers yet"}
            description={q ? "Try a different search." : "Add your first carrier to the directory."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Carrier</th>
                  <th className="px-5 py-3">Venues</th>
                  <th className="px-5 py-3">Shipments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((c) => (
                  <LinkRow key={c.id} href={`/carriers/${c.id}`} className="group hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/carriers/${c.id}`}
                        className="font-medium text-slate-900 group-hover:text-dts-maroon"
                      >
                        {c.carrier_name}
                      </Link>
                      {c.trade_show_notes ? (
                        <div className="max-w-md truncate text-xs text-slate-400">
                          {c.trade_show_notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{venueCount.get(c.id) ?? 0}</td>
                    <td className="px-5 py-3 text-slate-600">{shipCount.get(c.id) ?? 0}</td>
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
