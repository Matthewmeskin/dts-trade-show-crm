import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { inputClass } from "@/components/form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { QuickEditCarrier } from "./quick-edit";
import { SHIPMENT_STATUS_META } from "@/lib/shipments";
import { formatDate } from "@/lib/format";
import {
  deleteCarrier,
  addVenueToCarrier,
  removeVenueFromCarrier,
  addShowToCarrier,
  removeShowFromCarrier,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CarrierRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: carrier } = await supabase.from("carriers").select("*").eq("id", id).single();
  if (!carrier) notFound();

  const [linkRes, allVenuesRes, showLinkRes, allShowsRes, shipRes] = await Promise.all([
    supabase
      .from("carrier_venues")
      .select("venue:venues(id, venue_name, city, state)")
      .eq("carrier_id", id),
    supabase.from("venues").select("id, venue_name").order("venue_name"),
    supabase
      .from("carrier_shows")
      .select("show:shows(id, show_name, edition_year)")
      .eq("carrier_id", id),
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
    supabase
      .from("shipments")
      .select(
        "id, status, mode, pickup_date, pro_number, show:shows(show_name), exhibitor:exhibitors(company_name)",
      )
      .eq("carrier_id", id)
      .order("pickup_date", { ascending: true, nullsFirst: false }),
  ]);

  const venues = (linkRes.data ?? [])
    .map((r) => r.venue)
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .sort((a, b) => a.venue_name.localeCompare(b.venue_name));
  const linkedIds = new Set(venues.map((v) => v.id));
  const available = (allVenuesRes.data ?? []).filter((v) => !linkedIds.has(v.id));

  const shows = (showLinkRes.data ?? [])
    .map((r) => r.show)
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.show_name.localeCompare(b.show_name));
  const linkedShowIds = new Set(shows.map((s) => s.id));
  const availableShows = (allShowsRes.data ?? []).filter((s) => !linkedShowIds.has(s.id));

  const shipments = shipRes.data ?? [];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/carriers" className="hover:text-slate-700">Carriers</Link>
        <span>/</span>
        <span className="text-slate-600">{carrier.carrier_name}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
          {carrier.carrier_name}
        </h1>
        <div className="flex items-center gap-2">
          <QuickEditCarrier carrier={carrier} />
          <ConfirmDelete
            action={deleteCarrier}
            id={id}
            message={`Delete "${carrier.carrier_name}"? Shipments keep their records but lose the carrier link.`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Trade show notes" icon="carriers" />
            {carrier.trade_show_notes ? (
              <p className="whitespace-pre-wrap p-5 text-sm text-slate-700">
                {carrier.trade_show_notes}
              </p>
            ) : (
              <EmptyState icon="carriers" title="No notes yet" description="Edit this carrier to capture trade show intel." />
            )}
          </Card>

          <Card>
            <CardHeader title={`Shipment history (${shipments.length})`} icon="shipments" />
            {shipments.length === 0 ? (
              <EmptyState icon="shipments" title="No shipments" description="Shipments assigned to this carrier will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Exhibitor</th>
                      <th className="px-5 py-3">Show</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Mode</th>
                      <th className="px-5 py-3">Pickup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {shipments.map((s) => {
                      const sm = SHIPMENT_STATUS_META[s.status];
                      return (
                        <tr key={s.id} className="group hover:bg-slate-50/60">
                          <td className="px-5 py-3">
                            <Link href={`/shipments/${s.id}`} className="font-medium text-slate-800 group-hover:text-dts-maroon">
                              {s.exhibitor?.company_name ?? "Shipment"}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{s.show?.show_name ?? "—"}</td>
                          <td className="px-5 py-3">
                            <Badge className={sm.badge}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                              {sm.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{s.mode ?? "—"}</td>
                          <td className="px-5 py-3 text-slate-600">{formatDate(s.pickup_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title={`Shows serviced (${shows.length})`}
              icon="shows"
              action={
                availableShows.length > 0 ? (
                  <form action={addShowToCarrier} className="flex items-center gap-2">
                    <input type="hidden" name="carrier_id" value={id} />
                    <select name="show_id" required defaultValue="" className={`${inputClass} h-8 py-1 text-xs`}>
                      <option value="" disabled>Link show…</option>
                      {availableShows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.show_name}{s.edition_year ? ` ${s.edition_year}` : ""}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark">
                      Add
                    </button>
                  </form>
                ) : null
              }
            />
            {shows.length === 0 ? (
              <EmptyState icon="shows" title="No shows linked" description="Link the shows this carrier services." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {shows.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-5 py-3">
                    <Link href={`/shows/${s.id}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                      {s.show_name}
                      {s.edition_year ? <span className="ml-1 text-slate-400">{s.edition_year}</span> : null}
                    </Link>
                    <form action={removeShowFromCarrier}>
                      <input type="hidden" name="carrier_id" value={id} />
                      <input type="hidden" name="show_id" value={s.id} />
                      <button type="submit" className="text-xs font-medium text-slate-400 hover:text-dts-maroon">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`Venues serviced (${venues.length})`}
              icon="venues"
              action={
                available.length > 0 ? (
                  <form action={addVenueToCarrier} className="flex items-center gap-2">
                    <input type="hidden" name="carrier_id" value={id} />
                    <select name="venue_id" required defaultValue="" className={`${inputClass} h-8 py-1 text-xs`}>
                      <option value="" disabled>Link venue…</option>
                      {available.map((v) => (
                        <option key={v.id} value={v.id}>{v.venue_name}</option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark">
                      Add
                    </button>
                  </form>
                ) : null
              }
            />
            {venues.length === 0 ? (
              <EmptyState icon="venues" title="No venues linked" description="Link the venues this carrier services." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {venues.map((v) => (
                  <li key={v.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/venues/${v.id}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                        {v.venue_name}
                      </Link>
                      {v.city ? (
                        <div className="text-xs text-slate-400">
                          {v.city}{v.state ? `, ${v.state}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <form action={removeVenueFromCarrier}>
                      <input type="hidden" name="carrier_id" value={id} />
                      <input type="hidden" name="venue_id" value={v.id} />
                      <button type="submit" className="text-xs font-medium text-slate-400 hover:text-dts-maroon">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
