"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { Constants, type Tables } from "@/lib/database.types";
import { SHIPMENT_STATUS_META, type ShipmentStatus } from "@/lib/shipments";
import { detachShipmentFromShow } from "../actions";
import { CheckInCell } from "@/app/(app)/shipments/check-in-cell";
import { ShipmentEditDrawer } from "@/app/(app)/shipments/shipment-edit-drawer";

type Opt = { id: string; label: string };
type Row = Tables<"shipments"> & {
  exhibitor: { company_name: string } | null;
  carrier: { carrier_name: string } | null;
};

type Filter = "all" | ShipmentStatus;
const STATUSES = Constants.public.Enums.shipment_status;

export function ShipmentsTable({
  showId,
  rows,
  options,
}: {
  showId: string;
  rows: Row[];
  options: { shows: Opt[]; exhibitors: Opt[]; venues: Opt[] };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const searchParams = useSearchParams();

  // A successful save redirects here with ?flash=updated — close the drawer.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (searchParams.get("flash")) setEditing(null);
  }, [searchParams]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} className="bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20">
          All
        </FilterPill>
        {STATUSES.map((s) => {
          const meta = SHIPMENT_STATUS_META[s];
          return (
            <FilterPill
              key={s}
              active={filter === s}
              onClick={() => setFilter((f) => (f === s ? "all" : s))}
              className={meta.badge}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </FilterPill>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="shipments"
          title="No shipments logged"
          description="Shipments logged against this show will appear here."
        />
      ) : visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">
          No shipments with this status.
        </div>
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
                <th className="px-5 py-3">Check-in #</th>
                <th className="px-5 py-3">TMS</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.map((s) => {
                const sm = SHIPMENT_STATUS_META[s.status];
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="font-medium text-slate-800 hover:text-dts-maroon"
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
                    <td className="px-5 py-3">
                      <CheckInCell
                        shipmentId={s.id}
                        showId={showId}
                        value={s.check_in_number}
                        editable={s.direction === "move_out"}
                      />
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{s.tms_sync_status}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-dts-maroon"
                        >
                          <Icon name="shipments" className="h-3.5 w-3.5" /> Edit
                        </button>
                        <form action={detachShipmentFromShow}>
                          <input type="hidden" name="show_id" value={showId} />
                          <input type="hidden" name="shipment_id" value={s.id} />
                          <button type="submit" className="text-xs font-medium text-slate-400 hover:text-dts-maroon">
                            Remove
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <ShipmentEditDrawer
          shipment={editing}
          shows={options.shows}
          exhibitors={options.exhibitors}
          venues={options.venues}
          showId={showId}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function FilterPill({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${className} ${
        active ? "font-semibold shadow-sm" : "opacity-50 hover:opacity-100"
      }`}
    >
      {children}
    </button>
  );
}
