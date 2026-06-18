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
} from "@/lib/shipments";
import { formatDate } from "@/lib/format";
import { deleteShipment } from "../actions";

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
      "*, exhibitor:exhibitors(id, company_name), show:shows(id, show_name, edition_year), carrier:carriers(id, carrier_name)",
    )
    .eq("id", id)
    .single();

  if (!s) notFound();

  const sm = SHIPMENT_STATUS_META[s.status];
  const tms = TMS_SYNC_META[s.tms_sync_status];
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
          <Link
            href={`/shipments/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="shipments" className="h-4 w-4" /> Edit
          </Link>
          <ConfirmDelete
            action={deleteShipment}
            id={id}
            message="Delete this shipment? This cannot be undone."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
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

          <Card>
            <CardHeader title="Schedule" icon="calendar" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Pickup" value={formatDate(s.pickup_date)} />
              <Row label="Estimated delivery" value={formatDate(s.estimated_delivery_date)} />
              <Row label="Actual delivery" value={formatDate(s.actual_delivery_date)} />
            </dl>
          </Card>

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
            </dl>
          </Card>

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
