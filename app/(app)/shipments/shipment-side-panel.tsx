"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { LocalDateTime } from "@/components/local-time";
import { formatDate, formatCurrency } from "@/lib/format";
import { composeFreightAddress } from "@/lib/freight";
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
import { getShipmentDrawerData } from "./actions";
import { QuickEditShipment } from "./[id]/quick-edit";
import { CheckInCell } from "./check-in-cell";
import { ShipmentDocuments } from "./shipment-documents";
import { QuickEditShow } from "@/app/(app)/shows/[id]/quick-edit";
import { QuickEditExhibitor } from "@/app/(app)/exhibitors/[id]/quick-edit";
import { QuickEditVenue } from "@/app/(app)/venues/[id]/quick-edit";
import { QuickEditCarrier } from "@/app/(app)/carriers/[id]/quick-edit";

type DrawerData = NonNullable<Awaited<ReturnType<typeof getShipmentDrawerData>>>;

/**
 * Click-to-open right-side panel for a shipment — the calendar's "work from one
 * page" surface. Loads the full load (linked records + form options) on demand
 * and lets you see and edit every detail without leaving the calendar; saving
 * returns to wherever the panel was opened.
 */
/**
 * Controlled panel — the overlay is portaled to <body> so it can be opened from
 * anywhere (button, table row) without breaking table markup. Refetches the
 * load each time it opens so edits elsewhere are reflected.
 */
export function ShipmentPanel({
  id,
  open,
  onClose,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
}) {
  // Keyed by id so reopening a different load shows loading until its data
  // arrives. Only set state from the async callback (lint forbids setState
  // directly in an effect body).
  const [loaded, setLoaded] = useState<{ id: string; value: DrawerData | null } | null>(null);
  const pathname = usePathname();
  const search = useSearchParams();
  const returnTo = pathname + (search.toString() ? `?${search.toString()}` : "");

  useEffect(() => {
    if (!open) return;
    let active = true;
    getShipmentDrawerData(id).then((v) => {
      if (active) setLoaded({ id, value: v });
    });
    return () => {
      active = false;
    };
  }, [open, id]);

  const ready = loaded?.id === id;
  const data = ready ? loaded!.value : null;
  const loading = !ready;

  // Keep clicks inside the panel from closing it, but treat the form's "Cancel"
  // (a link back to the page we're already on) as a request to close the panel
  // rather than a no-op navigation.
  const onContentClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const url = new URL(a.href, window.location.origin);
    // Only intercept internal links back to this same page (the form's Cancel);
    // external links (e.g. a show website) must open normally.
    if (url.origin === window.location.origin && url.pathname + url.search === returnTo) {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-slate-900/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl"
        onClick={onContentClick}
      >
        <PanelBody data={data} loading={loading} returnTo={returnTo} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

/** Button trigger that opens the shipment panel (calendar / dashboard events). */
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
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ShipmentPanel id={id} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Table-row trigger that opens the shipment panel (shipments list). */
export function ShipmentRow({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={`cursor-pointer ${className}`}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("a,button,input,select,textarea,label,[role=button]")) return;
          setOpen(true);
        }}
      >
        {children}
      </tr>
      <ShipmentPanel id={id} open={open} onClose={() => setOpen(false)} />
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

        <div className="mb-4 flex items-center justify-end gap-2">
          {dir === "move_out" ? (
            <a
              href={`/api/move-out/${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Icon name="documents" className="h-4 w-4" /> Move-out form
            </a>
          ) : null}
          <QuickEditShipment
            shipment={s}
            shows={data.shows}
            exhibitors={data.exhibitors}
            venues={data.venues}
            redirectTo={returnTo}
            triggerClassName="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          />
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
          {dir === "move_out" ? (
            <Fact
              label="Check-in #"
              value={
                <CheckInCell
                  shipmentId={s.id}
                  showId={s.show_id ?? ""}
                  value={s.check_in_number}
                  editable
                />
              }
            />
          ) : null}
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
          <Fact
            label="PRO #"
            value={
              s.pro_number ? (
                s.tracking_url ? (
                  <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="text-dts-blue hover:underline">
                    {s.pro_number} ↗
                  </a>
                ) : (
                  s.pro_number
                )
              ) : null
            }
          />
          <Fact label="Weight" value={s.weight != null ? `${s.weight} lbs` : null} />
          <Fact label="Pieces" value={s.pieces != null ? String(s.pieces) : null} />
          <Fact label="Package" value={s.package_type} />
          <Fact label="Destination type" value={s.destination_type ? s.destination_type.replace(/_/g, " ") : null} />
          <Fact label="Billed" value={s.billed_amount != null ? formatCurrency(s.billed_amount, { cents: true }) : null} />
          <Fact label="Cost" value={s.cost_amount != null ? formatCurrency(s.cost_amount, { cents: true }) : null} />
          <Fact label="PO reference" value={s.po_ref} />
          <Fact label="Shipper number" value={s.shipper_number} />
          <Fact label="Show date" value={s.show_date ? formatDate(s.show_date) : null} />
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

        {s.special_requirements || s.notes ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <Note label="Special requirements" value={s.special_requirements} />
            <Note label="Notes" value={s.notes} />
          </div>
        ) : null}

        {/* Linked records — full detail, not just links */}
        {s.show ? (
          <LinkedSection
            title={`${s.show.show_name}${s.show.edition_year ? ` ${s.show.edition_year}` : ""}`}
            href={`/shows/${s.show.id}`}
            openLabel="Open show"
            editControl={
              <QuickEditShow
                show={s.show}
                venues={data.venueRecords}
                contacts={data.contacts}
                redirectTo={returnTo}
                triggerClassName="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              />
            }
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Fact label="Industry" value={s.show.industry_vertical} />
              <Fact label="Management co." value={s.show.show_management_company} />
              <Fact label="Show start" value={s.show.show_start_date ? formatDate(s.show.show_start_date) : null} />
              <Fact label="Show end" value={s.show.show_end_date ? formatDate(s.show.show_end_date) : null} />
              <Fact label="Move-in start" value={s.show.move_in_start ? formatDate(s.show.move_in_start) : null} />
              <Fact label="Move-in end" value={s.show.move_in_end ? formatDate(s.show.move_in_end) : null} />
              <Fact label="Move-out start" value={s.show.move_out_start ? formatDate(s.show.move_out_start) : null} />
              <Fact label="Move-out end" value={s.show.move_out_end ? formatDate(s.show.move_out_end) : null} />
              <Fact label="Adv. warehouse open" value={s.show.advance_warehouse_open ? formatDate(s.show.advance_warehouse_open) : null} />
              <Fact label="Adv. warehouse cutoff" value={s.show.advance_warehouse_cutoff ? formatDate(s.show.advance_warehouse_cutoff) : null} />
              <Fact label="Direct-to-show start" value={s.show.direct_to_show_start ? formatDate(s.show.direct_to_show_start) : null} />
              <Fact label="Direct-to-show end" value={s.show.direct_to_show_end ? formatDate(s.show.direct_to_show_end) : null} />
              <Fact label="Adv. warehouse address" value={addressValue({
                name: s.show.advance_warehouse_name,
                care_of: s.show.advance_warehouse_care_of,
                street1: s.show.advance_warehouse_street1,
                street2: s.show.advance_warehouse_street2,
                city: s.show.advance_warehouse_city,
                state: s.show.advance_warehouse_state,
                zip: s.show.advance_warehouse_zip,
                country: s.show.advance_warehouse_country,
              }, s.show.advance_warehouse_address)} className="col-span-2" />
              <Fact label="Direct-to-show address" value={addressValue({
                name: s.show.direct_to_show_name,
                care_of: s.show.direct_to_show_care_of,
                street1: s.show.direct_to_show_street1,
                street2: s.show.direct_to_show_street2,
                city: s.show.direct_to_show_city,
                state: s.show.direct_to_show_state,
                zip: s.show.direct_to_show_zip,
                country: s.show.direct_to_show_country,
              }, s.show.direct_to_show_address)} className="col-span-2" />
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
            editControl={<QuickEditExhibitor exhibitor={s.exhibitor} redirectTo={returnTo} triggerClassName="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50" />}
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
            editControl={<QuickEditVenue venue={s.venue} redirectTo={returnTo} triggerClassName="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50" />}
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
            editControl={<QuickEditCarrier carrier={s.carrier} redirectTo={returnTo} triggerClassName="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50" />}
          >
            <Note label="Trade show notes" value={s.carrier.trade_show_notes} />
            {!s.carrier.trade_show_notes ? (
              <p className="text-xs text-slate-400">No carrier notes captured.</p>
            ) : null}
          </LinkedSection>
        ) : null}

        <div className="mt-4">
          <ShipmentDocuments shipmentId={s.id} showId={s.show_id} />
        </div>
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
  editControl,
  children,
}: {
  title: string;
  href: string;
  openLabel: string;
  editControl?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link href={href} className="truncate font-medium text-dts-blue hover:underline">
          {title}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {editControl}
          <Link href={href} className="text-xs text-dts-blue hover:underline">
            {openLabel} ↗
          </Link>
        </div>
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

/**
 * Render a freight address from its structured parts as stacked lines, falling
 * back to a legacy single-line string (split on commas) when no parts are set.
 */
function addressValue(
  parts: Parameters<typeof composeFreightAddress>[0],
  legacy: string | null,
): ReactNode {
  const composed = composeFreightAddress(parts);
  const lines = composed.lines.length
    ? composed.lines
    : (legacy ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <span className="block">
      {lines.map((l, i) => (
        <span key={i} className="block leading-snug">{l}</span>
      ))}
    </span>
  );
}

function Fact({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{value ?? <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
