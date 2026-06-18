import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Constants } from "@/lib/database.types";
import {
  SHIPMENT_STATUS_META,
  TMS_SYNC_META,
  DESTINATION_LABELS,
  type ShipmentStatus,
  type ShipmentMode,
} from "@/lib/shipments";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    mode?: string;
    carrier?: string;
    show?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("shipments")
    .select(
      "id, status, mode, destination_type, pickup_date, pro_number, tms_sync_status, exhibitor:exhibitors(company_name), show:shows(show_name), carrier:carriers(carrier_name)",
    )
    .order("pickup_date", { ascending: false, nullsFirst: false });

  if (sp.status && (Constants.public.Enums.shipment_status as readonly string[]).includes(sp.status))
    query = query.eq("status", sp.status as ShipmentStatus);
  if (sp.mode && (Constants.public.Enums.shipment_mode as readonly string[]).includes(sp.mode))
    query = query.eq("mode", sp.mode as ShipmentMode);
  if (sp.carrier) query = query.eq("carrier_id", sp.carrier);
  if (sp.show) query = query.eq("show_id", sp.show);
  if (sp.q?.trim()) query = query.ilike("pro_number", `%${sp.q.trim()}%`);

  const [{ data: rows }, { data: carriers }, { data: shows }] = await Promise.all([
    query,
    supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
  ]);

  const shipments = rows ?? [];

  // Build status tabs preserving other filters.
  const statusTabs = [{ label: "All", value: "" }].concat(
    Constants.public.Enums.shipment_status.map((s) => ({
      label: SHIPMENT_STATUS_META[s].label,
      value: s,
    })),
  );
  const tabHref = (value: string) => {
    const p = new URLSearchParams();
    if (value) p.set("status", value);
    for (const k of ["mode", "carrier", "show", "q"] as const) {
      if (sp[k]) p.set(k, sp[k]!);
    }
    return `/shipments${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Shipments"
        description="Every shipment across your shows, with live TMS sync state."
        actions={
          <Link
            href="/shipments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> Log shipment
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1">
        {statusTabs.map((t) => {
          const active = (sp.status ?? "") === t.value;
          return (
            <Link
              key={t.label}
              href={tabHref(t.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
        <select name="show" defaultValue={sp.show ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All shows</option>
          {(shows ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.show_name}{s.edition_year ? ` ${s.edition_year}` : ""}
            </option>
          ))}
        </select>
        <select name="carrier" defaultValue={sp.carrier ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All carriers</option>
          {(carriers ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.carrier_name}</option>
          ))}
        </select>
        <select name="mode" defaultValue={sp.mode ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All modes</option>
          {Constants.public.Enums.shipment_mode.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="PRO #…" className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon" />
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
      </form>

      <Card>
        {shipments.length === 0 ? (
          <EmptyState
            icon="shipments"
            title="No shipments match"
            description="Log a shipment or adjust your filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Exhibitor</th>
                  <th className="px-5 py-3">Show</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Carrier</th>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Pickup</th>
                  <th className="px-5 py-3">TMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shipments.map((s) => {
                  const sm = SHIPMENT_STATUS_META[s.status];
                  const tms = TMS_SYNC_META[s.tms_sync_status];
                  return (
                    <LinkRow key={s.id} href={`/shipments/${s.id}`} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/shipments/${s.id}`} className="font-medium text-slate-900 group-hover:text-dts-maroon">
                          {s.exhibitor?.company_name ?? "—"}
                        </Link>
                        {s.pro_number ? (
                          <div className="text-xs text-slate-400">PRO {s.pro_number}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.show?.show_name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge className={sm.badge}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.mode ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{s.carrier?.carrier_name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {s.destination_type ? DESTINATION_LABELS[s.destination_type] : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(s.pickup_date)}</td>
                      <td className="px-5 py-3">
                        <Badge className={tms.badge}>{tms.label}</Badge>
                      </td>
                    </LinkRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
