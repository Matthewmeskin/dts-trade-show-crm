import Link from "next/link";
import { ShipmentRow } from "./shipment-side-panel";
import { HoverPreview } from "@/components/hover-preview";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Constants } from "@/lib/database.types";
import {
  SHIPMENT_STATUS_META,
  TMS_SYNC_META,
  DIRECTION_META,
  DELIVERY_HEALTH_META,
  effectiveDirection,
  effectiveTargetDate,
  deliveryHealth,
  type ShipmentStatus,
  type ShipmentMode,
  type ShipmentDirection,
} from "@/lib/shipments";
import { formatDate, formatShortDate, formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    mode?: string;
    carrier?: string;
    show?: string;
    direction?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("shipments")
    .select(
      "id, status, mode, destination_type, direction, target_delivery_date, show_date, estimated_delivery_date, actual_delivery_date, pickup_date, pro_number, tms_reference_id, margin, weight, pieces, origin_city, origin_state, destination_address, tms_sync_status, exhibitor:exhibitors(company_name), show:shows(show_name, move_in_start, move_out_start, move_out_end, advance_warehouse_cutoff), carrier:carriers(carrier_name), venue:venues(venue_name)",
    )
    // Quotes live on their own Quotes tab — keep them out of active shipments.
    .neq("status", "quoted")
    .order("pickup_date", { ascending: true, nullsFirst: false });

  if (sp.status && (Constants.public.Enums.shipment_status as readonly string[]).includes(sp.status))
    query = query.eq("status", sp.status as ShipmentStatus);
  if (sp.mode && (Constants.public.Enums.shipment_mode as readonly string[]).includes(sp.mode))
    query = query.eq("mode", sp.mode as ShipmentMode);
  if (sp.direction && (Constants.public.Enums.shipment_direction as readonly string[]).includes(sp.direction))
    query = query.eq("direction", sp.direction as ShipmentDirection);
  if (sp.carrier) query = query.eq("carrier_id", sp.carrier);
  if (sp.show) query = query.eq("show_id", sp.show);

  // Search matches PRO #, load # (TMS reference), or customer (exhibitor name).
  const term = sp.q?.trim();
  if (term) {
    // Resolve matching exhibitors first so we can search by company name.
    const { data: matchedExh } = await supabase
      .from("exhibitors")
      .select("id")
      .ilike("company_name", `%${term}%`);
    const exhIds = (matchedExh ?? []).map((e) => e.id);
    // Sanitize for PostgREST .or() syntax (commas/parens are delimiters).
    const safe = term.replace(/[(),]/g, " ");
    const ors = [`pro_number.ilike.%${safe}%`, `tms_reference_id.ilike.%${safe}%`];
    if (exhIds.length) ors.push(`exhibitor_id.in.(${exhIds.join(",")})`);
    query = query.or(ors.join(","));
  }

  const [{ data: rows }, { data: carriers }, { data: shows }] = await Promise.all([
    query,
    supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
  ]);

  // Enrich with delivery health, then sort chronologically (earliest first) by
  // pickup date so the team works the schedule in order; undated loads last.
  const shipments = (rows ?? [])
    .map((s) => {
      const dir = effectiveDirection(s);
      const target = effectiveTargetDate(s, s.show);
      const health = deliveryHealth({
        status: s.status,
        estimatedDelivery: s.estimated_delivery_date,
        actualDelivery: s.actual_delivery_date,
        target,
      });
      return { s, dir, target, health, rank: DELIVERY_HEALTH_META[health].rank };
    })
    .sort((a, b) =>
      (a.s.pickup_date ?? "9999-12-31").localeCompare(b.s.pickup_date ?? "9999-12-31"),
    );

  // Build status tabs preserving other filters.
  const statusTabs = [{ label: "All", value: "" }].concat(
    Constants.public.Enums.shipment_status
      .filter((s) => s !== "quoted")
      .map((s) => ({
        label: SHIPMENT_STATUS_META[s].label,
        value: s,
      })),
  );
  const tabHref = (value: string) => {
    const p = new URLSearchParams();
    if (value) p.set("status", value);
    for (const k of ["mode", "carrier", "show", "direction", "q"] as const) {
      if (sp[k]) p.set(k, sp[k]!);
    }
    return `/shipments${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Shipments"
        description="Every shipment across your shows, in schedule order (earliest pickup first)."
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
        <select name="direction" defaultValue={sp.direction ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">Move-in & out</option>
          {Constants.public.Enums.shipment_direction.map((dir) => (
            <option key={dir} value={dir}>{DIRECTION_META[dir].label}</option>
          ))}
        </select>
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
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search PRO #, load #, customer…" className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon" />
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
                  <th className="px-5 py-3">Delivery</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Carrier</th>
                  <th className="px-5 py-3">Venue</th>
                  <th className="px-5 py-3">Pickup</th>
                  <th className="px-5 py-3 text-right">Margin</th>
                  <th className="px-5 py-3">TMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shipments.map(({ s, dir, target, health }) => {
                  const sm = SHIPMENT_STATUS_META[s.status];
                  const tms = TMS_SYNC_META[s.tms_sync_status];
                  const hm = DELIVERY_HEALTH_META[health];
                  return (
                    <ShipmentRow key={s.id} id={s.id} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <HoverPreview
                          label={
                            <span className="font-medium text-slate-900 group-hover:text-dts-maroon">
                              {s.exhibitor?.company_name ?? "—"}
                            </span>
                          }
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{s.exhibitor?.company_name ?? "Shipment"}</span>
                              <Badge className={hm.badge}>{hm.label}</Badge>
                            </div>
                            <dl className="space-y-1 text-xs">
                              <PreviewRow label="Route" value={`${[s.origin_city, s.origin_state].filter(Boolean).join(", ") || "—"} → ${s.destination_address || "—"}`} />
                              <PreviewRow label="Direction" value={dir ? DIRECTION_META[dir].label : "—"} />
                              <PreviewRow label="Target" value={target ? formatDate(target) : "—"} />
                              <PreviewRow label="ETA" value={formatDate(s.estimated_delivery_date)} />
                              <PreviewRow label="Carrier" value={s.carrier?.carrier_name ?? "—"} />
                              <PreviewRow label="Freight" value={`${s.mode ?? "—"}${s.weight != null ? ` · ${s.weight} lbs` : ""}${s.pieces != null ? ` · ${s.pieces} pcs` : ""}`} />
                              <PreviewRow label="Margin" value={s.margin != null ? formatCurrency(s.margin, { cents: true }) : "—"} />
                            </dl>
                          </div>
                        </HoverPreview>
                        {s.pro_number ? (
                          <div className="text-xs text-slate-400">PRO {s.pro_number}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.show?.show_name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge className={hm.badge}>
                          <span className={`h-1.5 w-1.5 rounded-full ${hm.dot}`} />
                          {hm.label}
                        </Badge>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {dir ? DIRECTION_META[dir].label : ""}
                          {dir && target ? " · " : ""}
                          {target ? `by ${formatShortDate(target)}` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={sm.badge}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.carrier?.carrier_name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{s.venue?.venue_name ?? "—"}</td>
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
                      <td className="px-5 py-3">
                        <Badge className={tms.badge}>{tms.label}</Badge>
                      </td>
                    </ShipmentRow>
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="truncate text-right text-slate-700">{value}</dd>
    </div>
  );
}
