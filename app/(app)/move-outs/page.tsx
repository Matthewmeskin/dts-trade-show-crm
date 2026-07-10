import Link from "next/link";
import { ShipmentRow } from "../shipments/shipment-side-panel";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { loadSuccessfulMoveOuts } from "@/lib/move-outs";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Successful move-outs · DTS Trade Show CRM" };

export default async function MoveOutsPage() {
  const { rows, resetDate, lastForcedAt } = await loadSuccessfulMoveOuts();

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/" className="hover:text-slate-700">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-600">Successful move-outs</span>
      </div>

      <PageHeader
        title="Successful move-outs"
        description={`Delivered, non-forced move-outs since ${formatDate(resetDate)}. The count resets whenever a load is forced.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
            🚛
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Streak
            </div>
            <div className="text-3xl font-semibold text-emerald-600">{rows.length}</div>
            <div className="text-xs text-slate-500">
              since {formatDate(resetDate)}
              {lastForcedAt ? ` · last forced ${formatDate(lastForcedAt.slice(0, 10))}` : ""}
            </div>
          </div>
        </div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="truck"
            title="No successful move-outs yet"
            description="Delivered move-outs that weren't forced will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Exhibitor</th>
                  <th className="px-5 py-3">Show</th>
                  <th className="px-5 py-3">Carrier</th>
                  <th className="px-5 py-3">Picked up</th>
                  <th className="px-5 py-3">Delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => (
                  <ShipmentRow key={r.id} id={r.id} className="group hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-900 group-hover:text-dts-maroon">
                        {r.exhibitor ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.show ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{r.carrier ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {r.pickupDate ? formatDate(r.pickupDate) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {r.deliveredOn ? formatDate(r.deliveredOn) : <span className="text-slate-300">—</span>}
                    </td>
                  </ShipmentRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
