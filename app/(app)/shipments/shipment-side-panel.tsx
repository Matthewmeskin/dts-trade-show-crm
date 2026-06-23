"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { LocalDateTime } from "@/components/local-time";
import { formatDate, formatCurrency } from "@/lib/format";
import {
  SHIPMENT_STATUS_META,
  TMS_SYNC_META,
  DIRECTION_META,
  DELIVERY_HEALTH_META,
  effectiveDirection,
  effectiveTargetDate,
  deliveryHealth,
} from "@/lib/shipments";
import { hyperionShipmentUrl } from "@/lib/tms";
import { ShipmentForm } from "./shipment-form";
import { getShipmentDrawerData, updateShipment } from "./actions";

type DrawerData = NonNullable<Awaited<ReturnType<typeof getShipmentDrawerData>>>;

/**
 * Click-to-open right-side panel for a shipment — the calendar's "work from one
 * page" surface. Loads the full load (linked records + form options) on demand
 * and lets you see and edit every detail without leaving the calendar; saving
 * returns to wherever the panel was opened.
 */
export function ShipmentSidePanel({
  id,
  className = "block w-full text-left",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  const returnTo = pathname + (search.toString() ? `?${search.toString()}` : "");

  const openPanel = async () => {
    setOpen(true);
    if (!data && !loading) {
      setLoading(true);
      try {
        setData(await getShipmentDrawerData(id));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <button type="button" onClick={openPanel} className={className}>
        {children}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-slate-900/40"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <PanelBody data={data} loading={loading} returnTo={returnTo} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function PanelBody({
  data,
  loading,
  returnTo,
  onClose,
}: {
  data: DrawerData | null;
  loading: boolean;
  returnTo: string;
  onClose: () => void;
}) {
  if (loading || !data) {
    return (
      <>
        <PanelHeader title="Shipment" onClose={onClose} />
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          {loading ? "Loading…" : "Couldn't load this shipment."}
        </div>
      </>
    );
  }

  const s = data.shipment;
  const sm = SHIPMENT_STATUS_META[s.status];
  const tms = TMS_SYNC_META[s.tms_sync_status];
  const dir = effectiveDirection(s);
  const target = effectiveTargetDate(s, s.show);
  const health = deliveryHealth({
    status: s.status,
    estimatedDelivery: s.estimated_delivery_date,
    actualDelivery: s.actual_delivery_date,
    target,
  });
  const hm = DELIVERY_HEALTH_META[health];
  const hyperionUrl = hyperionShipmentUrl(s.tms_customer_id, s.tms_reference_id);

  return (
    <>
      <PanelHeader
        title={s.exhibitor?.company_name ?? "Shipment"}
        subtitle={s.show?.show_name ?? undefined}
        href={`/shipments/${s.id}`}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge className={sm.badge}>
            <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
          </Badge>
          {dir ? <Badge className={DIRECTION_META[dir].badge}>{DIRECTION_META[dir].label}</Badge> : null}
          <Badge className={hm.badge}>
            <span className={`h-1.5 w-1.5 rounded-full ${hm.dot}`} />
            {hm.label}
          </Badge>
          <Badge className={tms.badge}>TMS: {tms.label}</Badge>
        </div>

        {/* At-a-glance facts the edit form doesn't cover (TMS-synced). */}
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <Fact label="Carrier" value={s.carrier?.carrier_name} />
          <Fact label="Venue" value={s.venue ? <Link href={`/venues/${s.venue.id}`} className="text-dts-blue hover:underline">{s.venue.venue_name}</Link> : null} />
          <Fact label="Target delivery" value={target ? formatDate(target) : null} />
          <Fact label="Pickup" value={formatDate(s.pickup_date)} />
          <Fact label="Est. delivery" value={formatDate(s.estimated_delivery_date)} />
          <Fact label="Actual delivery" value={formatDate(s.actual_delivery_date)} />
          <Fact label="Margin" value={s.margin != null ? formatCurrency(s.margin, { cents: true }) : null} />
          <Fact
            label="Load #"
            value={
              s.tms_reference_id ? (
                hyperionUrl ? (
                  <a href={hyperionUrl} target="_blank" rel="noopener noreferrer" className="text-dts-blue hover:underline">
                    {s.tms_reference_id} ↗
                  </a>
                ) : (
                  s.tms_reference_id
                )
              ) : null
            }
          />
          <Fact
            label="Last synced"
            value={s.tms_last_synced_at ? <LocalDateTime iso={s.tms_last_synced_at} /> : null}
          />
        </dl>

        {/* Freight & route */}
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <Fact label="Mode" value={s.mode} />
          <Fact label="PRO #" value={s.pro_number} />
          <Fact label="Weight" value={s.weight != null ? `${s.weight} lbs` : null} />
          <Fact label="Pieces" value={s.pieces != null ? String(s.pieces) : null} />
          <Fact label="Package" value={s.package_type} />
          <Fact label="Destination type" value={s.destination_type ? s.destination_type.replace(/_/g, " ") : null} />
          <Fact label="Billed" value={s.billed_amount != null ? formatCurrency(s.billed_amount, { cents: true }) : null} />
          <Fact label="Cost" value={s.cost_amount != null ? formatCurrency(s.cost_amount, { cents: true }) : null} />
          <Fact
            label="Origin"
            value={
              [
                s.origin_street,
                [s.origin_city, s.origin_state].filter(Boolean).join(", "),
                s.origin_zip,
              ]
                .filter(Boolean)
                .join(" · ") || null
            }
            className="col-span-2"
          />
          <Fact label="Destination" value={s.destination_address} className="col-span-2" />
        </dl>

        {/* Linked records — full detail, not just links */}
        {s.show ? (
          <LinkedSection
            title={`${s.show.show_name}${s.show.edition_year ? ` ${s.show.edition_year}` : ""}`}
            href={`/shows/${s.show.id}`}
            openLabel="Open show"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Fact label="Industry" value={s.show.industry_vertical} />
              <Fact label="Management co." value={s.show.show_management_company} />
              <Fact label="Show dates" value={s.show.show_start_date ? formatDate(s.show.show_start_date) : null} />
              <Fact label="Move-in" value={s.show.move_in_start ? formatDate(s.show.move_in_start) : null} />
              <Fact label="Move-out" value={s.show.move_out_end ? formatDate(s.show.move_out_end) : null} />
              <Fact label="Adv. warehouse cutoff" value={s.show.advance_warehouse_cutoff ? formatDate(s.show.advance_warehouse_cutoff) : null} />
              <Fact label="Adv. warehouse address" value={s.show.advance_warehouse_address} className="col-span-2" />
              <Fact label="Direct-to-show address" value={s.show.direct_to_show_address} className="col-span-2" />
              <LinkFact label="Website" href={s.show.website_url} />
              <LinkFact label="Exhibitor manual" href={s.show.exhibitor_manual_url} />
              <LinkFact label="Exhibitor list" href={s.show.exhibitor_list_url} />
            </dl>
            <Note label="Show notes" value={s.show.general_notes} />
          </LinkedSection>
        ) : null}

        {s.exhibitor ? (
          <LinkedSection
            title={s.exhibitor.company_name}
            href={`/exhibitors/${s.exhibitor.id}`}
            openLabel="Open customer"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Fact label="Industry" value={s.exhibitor.industry} />
              <Fact label="Primary contact" value={[s.exhibitor.primary_contact_name, s.exhibitor.primary_contact_title].filter(Boolean).join(" · ") || null} />
              <Fact label="Email" value={s.exhibitor.primary_contact_email} />
              <Fact label="Phone" value={s.exhibitor.primary_contact_phone} />
            </dl>
            {secondaryContacts(s.exhibitor.secondary_contacts).length > 0 ? (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Other contacts</div>
                <ul className="space-y-1">
                  {secondaryContacts(s.exhibitor.secondary_contacts).map((c, i) => (
                    <li key={i} className="text-slate-700">
                      <span className="font-medium text-slate-800">{c.name || "—"}</span>
                      {c.title ? <span className="text-slate-400"> · {c.title}</span> : null}
                      {[c.email, c.phone].filter(Boolean).length ? (
                        <span className="text-slate-500"> — {[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Note label="Freight profile" value={s.exhibitor.freight_profile_notes} />
            <Note label="Notes" value={s.exhibitor.general_notes} />
          </LinkedSection>
        ) : null}

        {s.venue ? (
          <LinkedSection
            title={s.venue.venue_name}
            href={`/venues/${s.venue.id}`}
            openLabel="Open venue"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Fact label="Address" value={s.venue.address} className="col-span-2" />
              <Fact label="City" value={s.venue.city} />
              <Fact label="State" value={s.venue.state} />
            </dl>
            <Note label="Dock notes" value={s.venue.dock_notes} />
            <Note label="Union rules" value={s.venue.union_rules} />
            <Note label="Delivery restrictions" value={s.venue.delivery_restrictions} />
            <Note label="Parking & staging" value={s.venue.parking_and_staging_notes} />
            <Note label="General notes" value={s.venue.general_notes} />
          </LinkedSection>
        ) : null}

        {s.carrier ? (
          <LinkedSection
            title={s.carrier.carrier_name}
            href={`/carriers/${s.carrier.id}`}
            openLabel="Open carrier"
          >
            <Note label="Trade show notes" value={s.carrier.trade_show_notes} />
            {!s.carrier.trade_show_notes ? (
              <p className="text-xs text-slate-400">No carrier notes captured.</p>
            ) : null}
          </LinkedSection>
        ) : null}

        <ShipmentForm
          action={updateShipment}
          shipment={s}
          shows={data.shows}
          exhibitors={data.exhibitors}
          venues={data.venues}
          submitLabel="Save changes"
          redirectTo={returnTo}
        />
      </div>
    </>
  );
}

function PanelHeader({
  title,
  subtitle,
  href,
  onClose,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate font-heading text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="truncate text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {href ? (
          <Link
            href={href}
            className="rounded-lg px-2 py-1 text-xs font-medium text-dts-blue hover:bg-slate-100"
            title="Open full page"
          >
            Full page ↗
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function LinkedSection({
  title,
  href,
  openLabel,
  children,
}: {
  title: string;
  href: string;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link href={href} className="truncate font-medium text-dts-blue hover:underline">
          {title}
        </Link>
        <Link href={href} className="shrink-0 text-xs text-dts-blue hover:underline">
          {openLabel} ↗
        </Link>
      </div>
      {children}
    </div>
  );
}

function Note({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <p className="whitespace-pre-wrap text-slate-700">{value}</p>
    </div>
  );
}

function LinkFact({ label, href }: { label: string; href: string | null | undefined }) {
  if (!href) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5">
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-dts-blue hover:underline">
          Open ↗
        </a>
      </dd>
    </div>
  );
}

type SecondaryContact = { name?: string; title?: string; email?: string; phone?: string };
function secondaryContacts(value: unknown): SecondaryContact[] {
  return Array.isArray(value) ? (value as SecondaryContact[]) : [];
}

function Fact({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{value ?? <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
