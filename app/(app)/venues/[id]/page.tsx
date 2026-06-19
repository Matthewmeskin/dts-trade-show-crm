import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SHOW_STATUS_META } from "@/lib/shows";
import { SHIPMENT_STATUS_META, DIRECTION_META } from "@/lib/shipments";
import { formatDateRange, formatDate } from "@/lib/format";
import { deleteVenue } from "../actions";
import { QuickEditVenue } from "./quick-edit";

export const dynamic = "force-dynamic";

const INTEL_FIELDS = [
  { key: "dock_notes", label: "Dock notes" },
  { key: "union_rules", label: "Union rules" },
  { key: "delivery_restrictions", label: "Delivery restrictions" },
  { key: "parking_and_staging_notes", label: "Parking & staging" },
  { key: "general_notes", label: "General notes" },
] as const;

export default async function VenueRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: venue } = await supabase.from("venues").select("*").eq("id", id).single();
  if (!venue) notFound();

  const [showsRes, carrierRes, shipRes] = await Promise.all([
    supabase
      .from("shows_with_status")
      .select("id, show_name, edition_year, status, move_in_start, move_out_end")
      .eq("venue_id", id)
      .order("move_in_start", { ascending: true, nullsFirst: false }),
    supabase
      .from("carrier_venues")
      .select("carrier:carriers(id, carrier_name)")
      .eq("venue_id", id),
    supabase
      .from("shipments")
      .select("id, status, direction, pickup_date, exhibitor:exhibitors(company_name), show:shows(show_name)")
      .eq("venue_id", id)
      .order("pickup_date", { ascending: true, nullsFirst: false }),
  ]);

  const shows = showsRes.data ?? [];
  const shipments = shipRes.data ?? [];
  const carriers = (carrierRes.data ?? [])
    .map((r) => r.carrier)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const hasIntel = INTEL_FIELDS.some((f) => venue[f.key]);
  const location = [venue.city, venue.state].filter(Boolean).join(", ");

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/venues" className="hover:text-slate-700">
          Venues
        </Link>
        <span>/</span>
        <span className="text-slate-600">{venue.venue_name}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
            {venue.venue_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {[venue.address, location].filter(Boolean).join(" · ") || "Location not set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickEditVenue venue={venue} />
          <ConfirmDelete
            action={deleteVenue}
            id={id}
            message={`Delete "${venue.venue_name}"? Shows held here will keep their records but lose the venue link.`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Intel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Logistics intel" icon="venues" />
            {!hasIntel ? (
              <EmptyState
                icon="venues"
                title="No intel captured yet"
                description="Edit this venue to record dock, union, delivery, and staging notes."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {INTEL_FIELDS.filter((f) => venue[f.key]).map((f) => (
                  <div key={f.key} className="px-5 py-4">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {f.label}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {venue[f.key]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-5">
            <CardHeader title={`Loads at this venue (${shipments.length})`} icon="shipments" />
            {shipments.length === 0 ? (
              <EmptyState icon="shipments" title="No shipments routed through this venue yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Exhibitor</th>
                      <th className="px-5 py-3">Direction</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Show</th>
                      <th className="px-5 py-3">Pickup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {shipments.map((s) => {
                      const meta = SHIPMENT_STATUS_META[s.status];
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3">
                            <Link href={`/shipments/${s.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                              {s.exhibitor?.company_name ?? "Shipment"}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {s.direction ? DIRECTION_META[s.direction].label : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <Badge className={meta.badge}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{s.show?.show_name ?? "—"}</td>
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

        {/* Shows + carriers */}
        <div className="space-y-5">
          <Card>
            <CardHeader title={`Shows held here (${shows.length})`} icon="shows" />
            {shows.length === 0 ? (
              <EmptyState icon="shows" title="No shows yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {shows.map((s) => {
                  const meta = SHOW_STATUS_META[s.status ?? "upcoming"];
                  return (
                    <li key={s.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/shows/${s.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-dts-maroon"
                        >
                          {s.show_name}
                          {s.edition_year ? (
                            <span className="ml-1 text-slate-400">{s.edition_year}</span>
                          ) : null}
                        </Link>
                        <Badge className={meta.badge}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {formatDateRange(s.move_in_start, s.move_out_end)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={`Carriers (${carriers.length})`} icon="carriers" />
            {carriers.length === 0 ? (
              <EmptyState icon="carriers" title="No carriers linked" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {carriers.map((c) => (
                  <li key={c.id} className="px-5 py-3">
                    <Link
                      href={`/carriers/${c.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-dts-maroon"
                    >
                      {c.carrier_name}
                    </Link>
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
