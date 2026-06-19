import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  SHIPMENT_STATUS_META,
  TMS_SYNC_META,
  DESTINATION_LABELS,
  DIRECTION_META,
  DELIVERY_HEALTH_META,
  effectiveDirection,
  effectiveTargetDate,
  effectiveShowDate,
  deliveryHealth,
} from "@/lib/shipments";
import { formatDate, formatCurrency, formatCountdown, daysUntil } from "@/lib/format";
import { deleteShipment } from "../actions";
import { QuickEditShipment } from "./quick-edit";

export const dynamic = "force-dynamic";

export default async function ShipmentRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("shipments")
    .select(
      "*, exhibitor:exhibitors(id, company_name), show:shows(id, show_name, edition_year, move_in_start, move_out_start, move_out_end, advance_warehouse_cutoff), carrier:carriers(id, carrier_name), venue:venues(id, venue_name)",
    )
    .eq("id", id)
    .single();

  if (!s) notFound();

  const [{ data: showsData }, { data: exhibitorsData }] = await Promise.all([
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
    supabase.from("exhibitors").select("id, company_name").order("company_name"),
  ]);
  const showOptions = (showsData ?? []).map((x) => ({
    id: x.id,
    label: `${x.show_name}${x.edition_year ? ` ${x.edition_year}` : ""}`,
  }));
  const exhibitorOptions = (exhibitorsData ?? []).map((x) => ({ id: x.id, label: x.company_name }));

  const sm = SHIPMENT_STATUS_META[s.status];
  const tms = TMS_SYNC_META[s.tms_sync_status];
  const dir = effectiveDirection(s);
  const target = effectiveTargetDate(s, s.show);
  const showDate = effectiveShowDate(s, s.show);
  const health = deliveryHealth({
    status: s.status,
    estimatedDelivery: s.estimated_delivery_date,
    actualDelivery: s.actual_delivery_date,
    target,
  });
  const hm = DELIVERY_HEALTH_META[health];
  const title = s.exhibitor?.company_name ?? "Shipment";
  const origin = [s.origin_street, s.origin_city, s.origin_state, s.origin_zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/shipments" className="hover:text-slate-700">Shipments</Link>
        <span>/</span>
        <span className="text-slate-600">{title}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            <Badge className={sm.badge}>
              <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
              {sm.label}
            </Badge>
            {dir ? <Badge className={DIRECTION_META[dir].badge}>{DIRECTION_META[dir].label}</Badge> : null}
            {health !== "no_target" ? <Badge className={hm.badge}>{hm.label}</Badge> : null}
            <Badge className={tms.badge}>TMS: {tms.label}</Badge>
            {s.accessorials_flagged ? (
              <Badge className="bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <Icon name="alert" className="h-3.5 w-3.5" /> Accessorials
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {s.show?.show_name ?? "No show"}
            {s.pro_number ? ` · PRO ${s.pro_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickEditShipment shipment={s} shows={showOptions} exhibitors={exhibitorOptions} />
          <ConfirmDelete
            action={deleteShipment}
            id={id}
            message="Delete this shipment? This cannot be undone."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Delivery target — the thing to watch, especially for move-ins. */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Target delivery{dir ? ` · ${DIRECTION_META[dir].label}` : ""}
                </div>
                <div className="mt-0.5 text-xl font-semibold text-slate-900">
                  {target ? formatDate(target) : "Not set"}
                  {target ? (
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      {formatCountdown(daysUntil(target))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <Badge className={hm.badge}>
                  <span className={`h-1.5 w-1.5 rounded-full ${hm.dot}`} />
                  {hm.label}
                </Badge>
                <div className="mt-1 text-xs text-slate-400">
                  ETA {formatDate(s.estimated_delivery_date)}
                  {s.actual_delivery_date ? ` · Delivered ${formatDate(s.actual_delivery_date)}` : ""}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Schedule" icon="calendar" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Direction" value={dir ? DIRECTION_META[dir].label : null} />
              <Row
                label="Target delivery"
                value={target ? formatDate(target) : null}
              />
              <Row label="Delivery health" value={<Badge className={hm.badge}>{hm.label}</Badge>} />
              <Row label="Show date" value={showDate ? formatDate(showDate) : null} />
              <Row label="Pickup" value={formatDate(s.pickup_date)} />
              <Row label="Estimated delivery" value={formatDate(s.estimated_delivery_date)} />
              <Row label="Actual delivery" value={formatDate(s.actual_delivery_date)} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Route" icon="truck" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Origin" value={origin || null} />
              <Row label="Destination" value={s.destination_address} />
              {s.destination_type ? (
                <Row label="Receiving" value={DESTINATION_LABELS[s.destination_type]} />
              ) : null}
              <Row label="Mode" value={s.mode} />
              <Row label="Total pieces" value={s.pieces != null ? String(s.pieces) : null} />
              <Row label="Package type" value={s.package_type} />
              <Row label="Weight" value={s.weight != null ? `${s.weight} lbs` : null} />
              <Row
                label="Tracking"
                value={
                  s.tracking_url ? (
                    <a
                      href={s.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dts-blue hover:underline"
                    >
                      Track on carrier site ↗
                    </a>
                  ) : null
                }
              />
            </dl>
          </Card>

          {(s.billed_amount != null || s.cost_amount != null) && (
            <Card>
              <CardHeader title="Financials" icon="reports" />
              <dl className="divide-y divide-slate-100 text-sm">
                <Row
                  label="Billed (customer)"
                  value={s.billed_amount != null ? formatCurrency(s.billed_amount, { cents: true }) : null}
                />
                <Row
                  label="Cost (carrier)"
                  value={s.cost_amount != null ? formatCurrency(s.cost_amount, { cents: true }) : null}
                />
                <Row
                  label="Margin"
                  value={
                    s.margin != null ? (
                      <span className={s.margin < 0 ? "text-dts-maroon" : "text-emerald-600"}>
                        {formatCurrency(s.margin, { cents: true })}
                      </span>
                    ) : null
                  }
                />
              </dl>
            </Card>
          )}

          {(s.special_requirements || s.notes) && (
            <Card>
              <CardHeader title="Notes" icon="documents" />
              <div className="space-y-4 p-5 text-sm">
                {s.special_requirements ? (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      Special requirements
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{s.special_requirements}</p>
                  </div>
                ) : null}
                {s.notes ? (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      Notes
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{s.notes}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Linked records" icon="shows" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row
                label="Show"
                value={
                  s.show ? (
                    <Link href={`/shows/${s.show.id}`} className="text-dts-blue hover:underline">
                      {s.show.show_name}
                    </Link>
                  ) : null
                }
              />
              <Row
                label="Exhibitor"
                value={
                  s.exhibitor ? (
                    <Link href={`/exhibitors/${s.exhibitor.id}`} className="text-dts-blue hover:underline">
                      {s.exhibitor.company_name}
                    </Link>
                  ) : null
                }
              />
              <Row
                label="Carrier"
                value={
                  s.carrier ? (
                    <Link href={`/carriers/${s.carrier.id}`} className="text-dts-blue hover:underline">
                      {s.carrier.carrier_name}
                    </Link>
                  ) : null
                }
              />
              <Row
                label="Venue"
                value={
                  s.venue ? (
                    <Link href={`/venues/${s.venue.id}`} className="text-dts-blue hover:underline">
                      {s.venue.venue_name}
                    </Link>
                  ) : null
                }
              />
            </dl>
          </Card>

          {(s.po_ref || s.shipper_number) && (
            <Card>
              <CardHeader title="References" icon="documents" />
              <dl className="divide-y divide-slate-100 text-sm">
                <Row label="PO reference" value={s.po_ref} />
                <Row label="Shipper number" value={s.shipper_number} />
              </dl>
            </Card>
          )}

          <Card>
            <CardHeader title="TMS / BrokerWareLite" icon="sparkles" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Sync status" value={<Badge className={tms.badge}>{tms.label}</Badge>} />
              <Row label="Reference ID" value={s.tms_reference_id} />
              <Row
                label="Last synced"
                value={
                  s.tms_last_synced_at
                    ? formatDate(s.tms_last_synced_at.slice(0, 10))
                    : null
                }
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">
        {value ?? <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}
