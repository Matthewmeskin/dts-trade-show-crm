import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { LinkRow } from "@/components/link-row";
import { Icon } from "@/components/icons";
import { inputClass } from "@/components/form";
import {
  SHOW_STATUS_META,
  nextCriticalDeadline,
  type ShowWithStatus,
} from "@/lib/shows";
import { SHIPMENT_STATUS_META } from "@/lib/shipments";
import {
  formatDate,
  formatDateRange,
  formatCurrency,
  formatCountdown,
} from "@/lib/format";
import {
  addExhibitorToShow,
  removeExhibitorFromShow,
  attachShipmentToShow,
  detachShipmentFromShow,
} from "../actions";
import { documentDownload } from "@/app/(app)/documents/actions";
import { DeleteDocButton } from "@/app/(app)/documents/delete-doc-button";
import { DOCUMENT_TYPE_META } from "@/lib/documents";
import { DebriefForm } from "./debrief-form";
import { DeleteShowButton } from "./delete-show-button";
import { QuickEditShow } from "./quick-edit";
import type { Tables } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "exhibitors", label: "Exhibitors" },
  { key: "shipments", label: "Shipments" },
  { key: "carriers", label: "Carriers" },
  { key: "contacts", label: "Contacts" },
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "debrief", label: "Debrief" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ShowRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const active: TabKey =
    (TABS.find((t) => t.key === tab)?.key as TabKey) ?? "overview";

  const supabase = await createClient();
  const [
    { data: show },
    { data: links },
    { data: editRow },
    { data: venues },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("shows_with_status").select("*").eq("id", id).single(),
    supabase
      .from("shows")
      .select("website_url, exhibitor_manual_url, exhibitor_list_url")
      .eq("id", id)
      .single(),
    supabase.from("shows").select("*").eq("id", id).single(),
    supabase
      .from("venues")
      .select("id, venue_name, city, state")
      .order("venue_name"),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, company")
      .order("last_name"),
  ]);

  if (!show) notFound();

  const meta = SHOW_STATUS_META[show.status ?? "upcoming"];

  return (
    <div>
      {/* Header */}
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/shows" className="hover:text-slate-700">
          Shows
        </Link>
        <span>/</span>
        <span className="text-slate-600">{show.show_name}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
              {show.show_name}
              {show.edition_year ? (
                <span className="ml-1.5 font-normal text-slate-400">
                  {show.edition_year}
                </span>
              ) : null}
            </h1>
            <Badge className={meta.badge}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateRange(
              show.show_start_date ?? show.move_in_start,
              show.show_end_date ?? show.move_out_end,
            )}
            {show.industry_vertical ? ` · ${show.industry_vertical}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editRow ? (
            <QuickEditShow
              show={editRow as Tables<"shows">}
              venues={venues ?? []}
              contacts={contacts ?? []}
            />
          ) : null}
          <DeleteShowButton id={id} showName={show.show_name ?? "this show"} />
        </div>
      </div>

      {/* Tab nav */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={`/shows/${id}?tab=${t.key}`}
              className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-dts-maroon text-dts-maroon"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {active === "overview" && <OverviewTab show={show} links={links} />}
      {active === "exhibitors" && <ExhibitorsTab showId={id} />}
      {active === "shipments" && <ShipmentsTab showId={id} />}
      {active === "carriers" && <CarriersTab showId={id} />}
      {active === "contacts" && <ContactsTab showId={id} />}
      {active === "documents" && <DocumentsTab showId={id} />}
      {active === "tasks" && <TasksTab showId={id} />}
      {active === "debrief" && <DebriefTab showId={id} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

type ShowLinks = {
  website_url: string | null;
  exhibitor_manual_url: string | null;
  exhibitor_list_url: string | null;
} | null;

async function OverviewTab({ show, links }: { show: ShowWithStatus; links: ShowLinks }) {
  const supabase = await createClient();
  const [venueRes, contactRes] = await Promise.all([
    show.venue_id
      ? supabase
          .from("venues")
          .select("id, venue_name, city, state")
          .eq("id", show.venue_id)
          .single()
      : Promise.resolve({ data: null }),
    show.gsc_contact_id
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, company, email, phone")
          .eq("id", show.gsc_contact_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const venue = venueRes.data;
  const contact = contactRes.data;
  const deadline = nextCriticalDeadline(show);

  const variance =
    show.estimated_revenue != null && show.actual_revenue != null
      ? show.actual_revenue - show.estimated_revenue
      : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader title="Key dates" icon="calendar" />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-2xl bg-slate-100 sm:grid-cols-2">
            <DateCell label="Show start" value={show.show_start_date} />
            <DateCell label="Show end" value={show.show_end_date} />
            <DateCell label="Advance warehouse open" value={show.advance_warehouse_open} />
            <DateCell label="Advance warehouse cutoff" value={show.advance_warehouse_cutoff} />
            <DateCell label="Move-in start" value={show.move_in_start} />
            <DateCell label="Move-in end" value={show.move_in_end} />
            <DateCell label="Move-out start" value={show.move_out_start} />
            <DateCell label="Move-out end" value={show.move_out_end} />
            <DateCell label="Direct-to-show start" value={show.direct_to_show_start} />
            <DateCell label="Direct-to-show end" value={show.direct_to_show_end} />
          </div>
        </Card>

        {(show.competitor_notes || show.general_notes) && (
          <Card>
            <CardHeader title="Notes" icon="documents" />
            <div className="space-y-4 p-5 text-sm">
              {show.general_notes ? (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    General
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{show.general_notes}</p>
                </div>
              ) : null}
              {show.competitor_notes ? (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Competitor
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{show.competitor_notes}</p>
                </div>
              ) : null}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        {deadline ? (
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Next critical deadline
            </div>
            <div className="mt-1 font-heading text-lg font-semibold text-slate-900">
              {deadline.label}
            </div>
            <div className="mt-0.5 text-sm text-dts-maroon">
              {formatDate(deadline.date)} · {formatCountdown(deadline.days)}
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Details" icon="shows" />
          <dl className="divide-y divide-slate-100 text-sm">
            <DetailRow label="Industry" value={show.industry_vertical} />
            <DetailRow label="Management co." value={show.show_management_company} />
            <DetailRow
              label="Venue"
              value={
                venue ? (
                  <Link href={`/venues/${venue.id}`} className="text-dts-blue hover:underline">
                    {venue.venue_name}
                    {venue.city ? ` · ${venue.city}${venue.state ? `, ${venue.state}` : ""}` : ""}
                  </Link>
                ) : null
              }
            />
            <DetailRow
              label="GSC contact"
              value={
                contact
                  ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
                    contact.company ||
                    "—"
                  : null
              }
            />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Links" icon="documents" />
          {links && (links.website_url || links.exhibitor_manual_url || links.exhibitor_list_url) ? (
            <dl className="divide-y divide-slate-100 text-sm">
              <LinkDetailRow label="Show website" href={links.website_url} />
              <LinkDetailRow label="Exhibitor manual" href={links.exhibitor_manual_url} />
              <LinkDetailRow label="Exhibitor list" href={links.exhibitor_list_url} />
            </dl>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-400">
              No links yet. Use <span className="font-medium text-slate-500">Edit</span> to add the show
              website, exhibitor manual, and exhibitor list.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Revenue" icon="reports" />
          <dl className="divide-y divide-slate-100 text-sm">
            <DetailRow label="Estimated" value={formatCurrency(show.estimated_revenue)} />
            <DetailRow label="Actual" value={formatCurrency(show.actual_revenue)} />
            {variance != null ? (
              <DetailRow
                label="Variance"
                value={
                  <span className={variance >= 0 ? "text-emerald-600" : "text-dts-maroon"}>
                    {variance >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(variance))}
                  </span>
                }
              />
            ) : null}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function DateCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{formatDate(value)}</div>
    </div>
  );
}

function LinkDetailRow({ label, href }: { label: string; href: string | null }) {
  if (!href) return null;
  let display = href;
  try {
    display = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw href if it doesn't parse */
  }
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 truncate font-medium text-dts-blue hover:underline"
        >
          {display}
          <Icon name="external" className="h-3.5 w-3.5 shrink-0" />
        </a>
      </dd>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">
        {value ?? <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Exhibitors                                                                  */
/* -------------------------------------------------------------------------- */

async function ExhibitorsTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const [linkedRes, shipRes, allRes] = await Promise.all([
    supabase
      .from("show_exhibitors")
      .select("exhibitor:exhibitors(id, company_name, industry, primary_contact_name)")
      .eq("show_id", showId),
    supabase
      .from("shipments")
      .select("exhibitor:exhibitors(id, company_name, industry, primary_contact_name)")
      .eq("show_id", showId),
    supabase.from("exhibitors").select("id, company_name").order("company_name"),
  ]);

  // Exhibitors come from manual show_exhibitors links AND from the show's
  // shipments (where TMS-driven freight carries the link). Track which have a
  // manual link so only those expose a Remove control.
  type ExhRow = {
    id: string;
    company_name: string;
    industry: string | null;
    primary_contact_name: string | null;
    manual: boolean;
  };
  const byId = new Map<string, ExhRow>();
  for (const r of linkedRes.data ?? []) {
    if (r.exhibitor) byId.set(r.exhibitor.id, { ...r.exhibitor, manual: true });
  }
  for (const r of shipRes.data ?? []) {
    if (r.exhibitor && !byId.has(r.exhibitor.id))
      byId.set(r.exhibitor.id, { ...r.exhibitor, manual: false });
  }
  const linked = [...byId.values()].sort((a, b) =>
    a.company_name.localeCompare(b.company_name),
  );
  const linkedIds = new Set(linked.map((e) => e.id));
  const available = (allRes.data ?? []).filter((e) => !linkedIds.has(e.id));

  return (
    <Card>
      <CardHeader
        title={`Exhibitors (${linked.length})`}
        icon="exhibitors"
        action={
          available.length > 0 ? (
            <form action={addExhibitorToShow} className="flex items-center gap-2">
              <input type="hidden" name="show_id" value={showId} />
              <select name="exhibitor_id" required className={`${inputClass} h-8 py-1 text-xs`} defaultValue="">
                <option value="" disabled>
                  Add existing exhibitor…
                </option>
                {available.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.company_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark"
              >
                Add
              </button>
            </form>
          ) : null
        }
      />
      {linked.length === 0 ? (
        <EmptyState
          icon="exhibitors"
          title="No exhibitors on this show"
          description="Add an existing exhibitor, or create one in the Exhibitors section first."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {linked.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <Link href={`/exhibitors/${e.id}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                  {e.company_name}
                </Link>
                {[e.industry, e.primary_contact_name].filter(Boolean).length > 0 ? (
                  <div className="text-xs text-slate-400">
                    {[e.industry, e.primary_contact_name].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
              {e.manual ? (
                <form action={removeExhibitorFromShow}>
                  <input type="hidden" name="show_id" value={showId} />
                  <input type="hidden" name="exhibitor_id" value={e.id} />
                  <button type="submit" className="text-xs font-medium text-slate-400 hover:text-dts-maroon">
                    Remove
                  </button>
                </form>
              ) : (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Via freight
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                   */
/* -------------------------------------------------------------------------- */

async function ShipmentsTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const [{ data }, { data: unlinkedData }] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, status, mode, destination_type, pickup_date, pro_number, tms_sync_status, exhibitor:exhibitors(company_name), carrier:carriers(carrier_name)",
      )
      .eq("show_id", showId)
      .order("pickup_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("shipments")
      .select("id, tms_reference_id, exhibitor:exhibitors(company_name)")
      .is("show_id", null)
      .order("tms_reference_id", { nullsFirst: false }),
  ]);

  const rows = data ?? [];
  const unlinked = unlinkedData ?? [];

  return (
    <Card>
      <CardHeader
        title={`Shipments (${rows.length})`}
        icon="shipments"
        action={
          <div className="flex items-center gap-2">
            {unlinked.length > 0 ? (
              <form action={attachShipmentToShow} className="flex items-center gap-1.5">
                <input type="hidden" name="show_id" value={showId} />
                <select name="shipment_id" required defaultValue="" className={`${inputClass} h-8 py-1 text-xs`}>
                  <option value="" disabled>Attach existing…</option>
                  {unlinked.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.exhibitor?.company_name ?? "Shipment"}
                      {s.tms_reference_id ? ` · ${s.tms_reference_id}` : ""}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Add
                </button>
              </form>
            ) : null}
            <Link
              href={`/shipments/new?show=${showId}`}
              className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark"
            >
              Log shipment
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon="shipments"
          title="No shipments logged"
          description="Shipments logged against this show will appear here."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Exhibitor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Carrier</th>
                <th className="px-5 py-3">Pickup</th>
                <th className="px-5 py-3">PRO #</th>
                <th className="px-5 py-3">TMS</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((s) => {
                const sm = SHIPMENT_STATUS_META[s.status];
                return (
                  <LinkRow key={s.id} href={`/shipments/${s.id}`} className="group hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="font-medium text-slate-800 group-hover:text-dts-maroon"
                      >
                        {s.exhibitor?.company_name ?? "Shipment"}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={sm.badge}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.mode ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{s.carrier?.carrier_name ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(s.pickup_date)}</td>
                    <td className="px-5 py-3 text-slate-600">{s.pro_number ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{s.tms_sync_status}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={detachShipmentFromShow}>
                        <input type="hidden" name="show_id" value={showId} />
                        <input type="hidden" name="shipment_id" value={s.id} />
                        <button type="submit" className="text-xs font-medium text-slate-400 hover:text-dts-maroon">
                          Remove
                        </button>
                      </form>
                    </td>
                  </LinkRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Carriers (derived from this show's shipments)                               */
/* -------------------------------------------------------------------------- */

async function CarriersTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shipments")
    .select("carrier_id, carrier:carriers(id, carrier_name)")
    .eq("show_id", showId)
    .not("carrier_id", "is", null);

  const counts = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    if (!row.carrier) continue;
    const prev = counts.get(row.carrier.id) ?? { name: row.carrier.carrier_name, count: 0 };
    prev.count += 1;
    counts.set(row.carrier.id, prev);
  }
  const carriers = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <Card>
      <CardHeader title={`Carriers (${carriers.length})`} icon="carriers" />
      {carriers.length === 0 ? (
        <EmptyState
          icon="carriers"
          title="No carriers yet"
          description="Carriers appear here once shipments are assigned to them on this show."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {carriers.map(([cid, c]) => (
            <li key={cid} className="flex items-center justify-between px-5 py-3">
              <Link href={`/carriers/${cid}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                {c.name}
              </Link>
              <span className="text-xs text-slate-400">
                {c.count} shipment{c.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Contacts                                                                    */
/* -------------------------------------------------------------------------- */

async function ContactsTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, title, company, email, phone, contact_type")
    .eq("show_id", showId)
    .order("last_name");

  const rows = data ?? [];
  return (
    <Card>
      <CardHeader
        title={`Contacts (${rows.length})`}
        icon="contacts"
        action={
          <Link
            href={`/contacts/new?show=${showId}`}
            className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark"
          >
            Add contact
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon="contacts" title="No contacts" description="Contacts attached to this show will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((c) => (
            <li key={c.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <Link href={`/contacts/${c.id}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}
                </Link>
                {c.contact_type ? (
                  <span className="text-xs text-slate-400">{c.contact_type.replace(/_/g, " ")}</span>
                ) : null}
              </div>
              <div className="text-xs text-slate-400">
                {[c.title, c.company].filter(Boolean).join(" · ")}
                {c.email ? ` · ${c.email}` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

async function DocumentsTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, document_name, document_type, file_url, uploaded_at")
    .eq("show_id", showId)
    .order("uploaded_at", { ascending: false });

  const rows = data ?? [];
  return (
    <Card>
      <CardHeader
        title={`Documents (${rows.length})`}
        icon="documents"
        action={
          <Link
            href={`/documents/new?show=${showId}`}
            className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark"
          >
            Upload document
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon="documents" title="No documents" description="Files uploaded to this show will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((doc) => {
            const meta = doc.document_type ? DOCUMENT_TYPE_META[doc.document_type] : null;
            return (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <form action={documentDownload}>
                    <input type="hidden" name="path" value={doc.file_url ?? ""} />
                    <button
                      type="submit"
                      disabled={!doc.file_url}
                      className="truncate text-sm font-medium text-slate-900 hover:text-dts-maroon disabled:text-slate-400"
                    >
                      {doc.document_name}
                    </button>
                  </form>
                  {meta ? <div className="text-xs text-slate-400">{meta.label}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDate(doc.uploaded_at.slice(0, 10))}</span>
                  <DeleteDocButton id={doc.id} path={doc.file_url} showId={showId} name={doc.document_name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                       */
/* -------------------------------------------------------------------------- */

const TASK_PRIORITY: Record<string, string> = {
  high: "bg-dts-maroon/10 text-dts-maroon ring-1 ring-inset ring-dts-maroon/25",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
};
const TASK_STATUS: Record<string, string> = {
  open: "text-slate-500",
  in_progress: "text-dts-blue",
  completed: "text-emerald-600",
};

async function TasksTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_date, status, priority, assignee:profiles!tasks_assigned_to_fkey(full_name)")
    .eq("related_show_id", showId)
    .order("due_date", { ascending: true, nullsFirst: false });

  const rows = data ?? [];
  return (
    <Card>
      <CardHeader
        title={`Tasks (${rows.length})`}
        icon="tasks"
        action={
          <Link
            href={`/tasks/new?show=${showId}`}
            className="rounded-lg bg-dts-maroon px-2.5 py-1 text-xs font-medium text-white hover:bg-dts-maroon-dark"
          >
            Add task
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon="tasks" title="No tasks" description="Tasks related to this show will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link href={`/tasks/${t.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-dts-maroon">
                  {t.title}
                </Link>
                <div className="text-xs text-slate-400">
                  {t.assignee?.full_name ? `${t.assignee.full_name} · ` : ""}
                  {t.due_date ? `due ${formatDate(t.due_date)} · ` : ""}
                  <span className={TASK_STATUS[t.status]}>{t.status.replace(/_/g, " ")}</span>
                </div>
              </div>
              <Badge className={TASK_PRIORITY[t.priority]}>{t.priority}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Debrief                                                                     */
/* -------------------------------------------------------------------------- */

async function DebriefTab({ showId }: { showId: string }) {
  const supabase = await createClient();
  const { data: debrief } = await supabase
    .from("show_debriefs")
    .select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Card>
      <CardHeader title="Show debrief" icon="reports" />
      <div className="p-5">
        <p className="mb-4 text-sm text-slate-500">
          Capture the post-show retrospective. Recommended once the show moves to
          completed.
        </p>
        <DebriefForm showId={showId} debrief={debrief ?? null} />
      </div>
    </Card>
  );
}
