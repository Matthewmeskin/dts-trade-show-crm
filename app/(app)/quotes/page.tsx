import { ShipmentRow } from "../shipments/shipment-side-panel";
import { ShipmentsTabs } from "../shipments/shipments-tabs";
import { HoverPreview } from "@/components/hover-preview";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { DIRECTION_META, effectiveDirection } from "@/lib/shipments";
import { formatDate, formatCurrency } from "@/lib/format";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quotes · DTS Trade Show CRM" };

const PAGE_SIZE = 50;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const supabase = await createClient();

  const SELECT =
    "id, status, mode, direction, destination_type, pickup_date, target_delivery_date, show_date, billed_amount, cost_amount, margin, created_at, tms_created_at, tms_reference_id, origin_city, origin_state, destination_address, exhibitor:exhibitors(company_name), show:shows(show_name), carrier:carriers(carrier_name), venue:venues(venue_name)";
  // Fetch only the requested page + an exact count — never the whole table.
  const quotesPage = (from: number) =>
    supabase
      .from("shipments")
      .select(SELECT, { count: "exact" })
      .eq("status", "quoted")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

  const requested = Math.max(1, Number(pageParam) || 1);
  const first = await quotesPage((requested - 1) * PAGE_SIZE);
  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  // If the URL asked for a page past the end, fetch the clamped last page.
  const pagedQuotes =
    page === requested ? first.data ?? [] : (await quotesPage((page - 1) * PAGE_SIZE)).data ?? [];
  const pageHref = (p: number) => (p > 1 ? `/quotes?page=${p}` : "/quotes");

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Shipments still in the quoting stage — separate from active shipments. Mark one Booked to move it onto Shipments."
      />

      <ShipmentsTabs active="quotes" />

      <Card>
        {total === 0 ? (
          <EmptyState
            icon="documents"
            title="No open quotes"
            description="Shipments with a Quoted status appear here until they're booked."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Show</th>
                  <th className="px-5 py-3">Direction</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Carrier</th>
                  <th className="px-5 py-3 text-right">Billed</th>
                  <th className="px-5 py-3 text-right">Cost</th>
                  <th className="px-5 py-3 text-right">Margin</th>
                  <th className="px-5 py-3">Quoted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedQuotes.map((s) => {
                  const dir = effectiveDirection(s);
                  return (
                    <ShipmentRow key={s.id} id={s.id} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <HoverPreview
                          label={
                            <span className="font-medium text-slate-900 group-hover:text-dts-maroon">
                              {s.exhibitor?.company_name ?? "—"}
                            </span>
                          }
                        >
                          <div className="space-y-2">
                            <div className="font-medium text-slate-900">{s.exhibitor?.company_name ?? "Quote"}</div>
                            <dl className="space-y-1 text-xs">
                              <PreviewRow label="Route" value={`${[s.origin_city, s.origin_state].filter(Boolean).join(", ") || "—"} → ${s.destination_address || "—"}`} />
                              <PreviewRow label="Venue" value={s.venue?.venue_name ?? "—"} />
                              <PreviewRow label="Carrier" value={s.carrier?.carrier_name ?? "—"} />
                              <PreviewRow label="Pickup target" value={formatDate(s.pickup_date)} />
                            </dl>
                          </div>
                        </HoverPreview>
                        {s.tms_reference_id ? (
                          <div className="text-xs text-slate-400">Load {s.tms_reference_id}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.show?.show_name ?? "—"}</td>
                      <td className="px-5 py-3">
                        {dir ? (
                          <Badge className={DIRECTION_META[dir].badge}>{DIRECTION_META[dir].label}</Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.mode ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{s.carrier?.carrier_name ?? "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {s.billed_amount != null ? formatCurrency(s.billed_amount, { cents: true }) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {s.cost_amount != null ? formatCurrency(s.cost_amount, { cents: true }) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {s.margin != null ? (
                          <span className={s.margin < 0 ? "text-dts-maroon" : "text-slate-700"}>
                            {formatCurrency(s.margin, { cents: true })}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {s.tms_created_at ? formatDate(s.tms_created_at) : <span className="text-slate-300">—</span>}
                      </td>
                    </ShipmentRow>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} makeHref={pageHref} />
          </div>
        )}
      </Card>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="truncate text-right text-slate-700">{value}</dd>
    </div>
  );
}
