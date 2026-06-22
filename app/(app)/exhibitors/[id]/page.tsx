import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkRow } from "@/components/link-row";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SHOW_STATUS_META } from "@/lib/shows";
import { SHIPMENT_STATUS_META } from "@/lib/shipments";
import { formatDate, formatDateRange, formatCurrency } from "@/lib/format";
import { deleteExhibitor } from "../actions";
import { QuickEditExhibitor } from "./quick-edit";

export const dynamic = "force-dynamic";

type SecondaryContact = {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
};

export default async function ExhibitorRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const supabase = await createClient();

  const { data: e } = await supabase.from("exhibitors").select("*").eq("id", id).single();
  if (!e) notFound();

  // Shows participated (two-step to avoid view embedding).
  const { data: links } = await supabase
    .from("show_exhibitors")
    .select("show_id")
    .eq("exhibitor_id", id);
  const showIds = (links ?? []).map((l) => l.show_id);

  let shipQuery = supabase
    .from("shipments")
    .select(
      "id, status, mode, pickup_date, pro_number, margin, show:shows(show_name), carrier:carriers(carrier_name)",
    )
    .eq("exhibitor_id", id);
  if (from) shipQuery = shipQuery.gte("pickup_date", from);
  if (to) shipQuery = shipQuery.lte("pickup_date", to);

  const [showsRes, shipRes] = await Promise.all([
    showIds.length
      ? supabase
          .from("shows_with_status")
          .select("id, show_name, edition_year, status, move_in_start, move_out_end")
          .in("id", showIds)
          .order("move_in_start", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as never[] }),
    shipQuery.order("pickup_date", { ascending: true, nullsFirst: false }),
  ]);

  const shows = showsRes.data ?? [];
  const shipments = shipRes.data ?? [];
  const marginTotal = shipments.reduce((sum, s) => sum + (s.margin ?? 0), 0);
  const hasMargin = shipments.some((s) => s.margin != null);
  const secondary = (Array.isArray(e.secondary_contacts)
    ? e.secondary_contacts
    : []) as SecondaryContact[];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/exhibitors" className="hover:text-slate-700">
          Exhibitors
        </Link>
        <span>/</span>
        <span className="text-slate-600">{e.company_name}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
            {e.company_name}
          </h1>
          {e.industry ? (
            <p className="mt-1 text-sm text-slate-500">{e.industry}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <QuickEditExhibitor exhibitor={e} />
          <ConfirmDelete
            action={deleteExhibitor}
            id={id}
            message={`Delete "${e.company_name}"? This removes its show links and clears it from shipments. This cannot be undone.`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Shipment history */}
          <Card>
            <CardHeader
              title={`Shipment history (${shipments.length})`}
              icon="shipments"
              action={
                <form className="flex flex-wrap items-center gap-1.5 text-sm">
                  <input
                    type="date"
                    name="from"
                    defaultValue={from ?? ""}
                    aria-label="From date"
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    name="to"
                    defaultValue={to ?? ""}
                    aria-label="To date"
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Apply
                  </button>
                  {from || to ? (
                    <Link
                      href={`/exhibitors/${id}`}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-700"
                    >
                      Clear
                    </Link>
                  ) : null}
                </form>
              }
            />
            {shipments.length === 0 ? (
              <EmptyState icon="shipments" title="No shipments" description={from || to ? "No shipments in this date range." : "Shipments for this exhibitor will appear here."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Show</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Mode</th>
                      <th className="px-5 py-3">Carrier</th>
                      <th className="px-5 py-3">Pickup</th>
                      <th className="px-5 py-3 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {shipments.map((s) => {
                      const sm = SHIPMENT_STATUS_META[s.status];
                      return (
                        <LinkRow key={s.id} href={`/shipments/${s.id}`} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {s.show?.show_name ?? "—"}
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
                          <td className="px-5 py-3 text-right tabular-nums">
                            {s.margin != null ? (
                              <span className={s.margin < 0 ? "text-dts-maroon" : "text-slate-700"}>
                                {formatCurrency(s.margin, { cents: true })}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </LinkRow>
                      );
                    })}
                  </tbody>
                  {hasMargin ? (
                    <tfoot>
                      <tr className="border-t border-slate-200 font-semibold text-slate-900">
                        <td className="px-5 py-3" colSpan={5}>
                          Total margin{from || to ? " (range)" : ""}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <span className={marginTotal < 0 ? "text-dts-maroon" : "text-slate-900"}>
                            {formatCurrency(marginTotal, { cents: true })}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            )}
          </Card>

          {/* Notes */}
          {(e.freight_profile_notes || e.general_notes) && (
            <Card>
              <CardHeader title="Notes" icon="documents" />
              <div className="space-y-4 p-5 text-sm">
                {e.freight_profile_notes ? (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      Freight profile
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{e.freight_profile_notes}</p>
                  </div>
                ) : null}
                {e.general_notes ? (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      General
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{e.general_notes}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Contacts */}
          <Card>
            <CardHeader title="Contacts" icon="contacts" />
            <div className="p-5 text-sm">
              {e.primary_contact_name ||
              e.primary_contact_email ||
              e.primary_contact_phone ? (
                <div className="mb-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Primary
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {e.primary_contact_name ?? "—"}
                    {e.primary_contact_title ? (
                      <span className="font-normal text-slate-400"> · {e.primary_contact_title}</span>
                    ) : null}
                  </div>
                  <div className="text-slate-500">
                    {[e.primary_contact_email, e.primary_contact_phone].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No primary contact.</p>
              )}

              {secondary.length > 0 ? (
                <div className="mt-2 border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Secondary
                  </div>
                  <ul className="mt-1 space-y-2">
                    {secondary.map((c, i) => (
                      <li key={i}>
                        <div className="font-medium text-slate-800">
                          {c.name || "—"}
                          {c.title ? (
                            <span className="font-normal text-slate-400"> · {c.title}</span>
                          ) : null}
                        </div>
                        <div className="text-slate-500">
                          {[c.email, c.phone].filter(Boolean).join(" · ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          {/* Shows participated */}
          <Card>
            <CardHeader title={`Shows (${shows.length})`} icon="shows" />
            {shows.length === 0 ? (
              <EmptyState icon="shows" title="No shows yet" description="Add this exhibitor to a show from the show record." />
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
        </div>
      </div>
    </div>
  );
}
