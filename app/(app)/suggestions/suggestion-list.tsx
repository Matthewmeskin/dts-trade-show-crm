"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Field, inputClass } from "@/components/form";
import {
  createVenueAndLink,
  createShowAndLink,
  linkShipmentsToVenue,
  linkShipmentsToShow,
} from "./actions";

export type ClusterShipment = {
  id: string;
  ref: string | null;
  venueRaw: string | null;
  booth: string | null;
  exhibitor: string | null;
  date: string | null;
  hasVenue: boolean;
  hasShow: boolean;
};

export type ShowGroup = {
  id: string;
  isAdvanceWarehouse: boolean;
  label: string;
  dateRangeLabel: string | null;
  loadIds: string[];
  count: number;
  needsShow: number;
  matchedShow: { id: string; name: string } | null;
  shipments: ClusterShipment[];
};

export type Cluster = {
  city: string | null;
  state: string | null;
  addressLabel: string | null;
  shipmentIds: string[];
  count: number;
  venueTexts: string[];
  exhibitors: string[];
  matchedVenue: { id: string; name: string } | null;
  needsVenue: number;
  groups: ShowGroup[];
};

export type VenueOption = { id: string; label: string };
export type ShowOption = { id: string; label: string; venueId: string | null };

type Discovered = {
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  show_name: string | null;
  edition_year: number | null;
  website_url: string | null;
  exhibitor_manual_url: string | null;
  exhibitor_list_url: string | null;
  show_start_date: string | null;
  show_end_date: string | null;
  move_in_start: string | null;
  move_out_end: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
  sources: string[];
};

const CONF = {
  high: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export function SuggestionList({
  clusters,
  venues,
  shows,
}: {
  clusters: Cluster[];
  venues: VenueOption[];
  shows: ShowOption[];
}) {
  return (
    <div className="space-y-4">
      {clusters.map((c, i) => (
        <ClusterCard key={i} cluster={c} venues={venues} shows={shows} />
      ))}
    </div>
  );
}

/** A typeahead over existing records — type to filter, click to pick. */
function Combobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
    return base.slice(0, 8);
  }, [q, options]);

  return (
    <div className="relative">
      <input
        value={open ? q : selected?.label ?? ""}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-56 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
      />
      {open && filtered.length ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
                className={`block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${o.id === value ? "font-medium text-dts-maroon" : "text-slate-700"}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ClusterCard({
  cluster,
  venues,
  shows,
}: {
  cluster: Cluster;
  venues: VenueOption[];
  shows: ShowOption[];
}) {
  const router = useRouter();
  const place = [cluster.city, cluster.state].filter(Boolean).join(", ") || "Unknown location";
  const heading = cluster.addressLabel ?? place;

  const [busy, setBusy] = useState<null | "venue" | "createvenue" | "discover">(null);
  const [error, setError] = useState<string | null>(null);

  // Assigned venue: starts at the confident auto-match, updated when linked.
  const [venueId, setVenueId] = useState<string | null>(cluster.matchedVenue?.id ?? null);
  const [venueLabel, setVenueLabel] = useState<string | null>(cluster.matchedVenue?.name ?? null);
  const [pickVenue, setPickVenue] = useState<string>(cluster.matchedVenue?.id ?? "");
  const [overrideVenue, setOverrideVenue] = useState(false);

  // Web-discovery modal (creates a venue, or a show for one date group).
  const [d, setD] = useState<Discovered | null>(null);
  const [modal, setModal] = useState<null | { kind: "venue" } | { kind: "show"; loadIds: string[] }>(null);
  const [v, setV] = useState({ name: "", address: "", city: cluster.city ?? "", state: cluster.state ?? "" });
  const [s, setS] = useState({ name: "", year: "", website: "", manual: "", list: "", start: "", end: "", moveIn: "", moveOut: "" });

  const showsAtVenue = venueId ? shows.filter((sh) => sh.venueId === venueId) : shows;

  async function linkVenueTo(id: string) {
    if (!id) return;
    setBusy("venue");
    setError(null);
    const fd = new FormData();
    fd.set("venue_id", id);
    fd.set("shipment_ids", cluster.shipmentIds.join(","));
    await linkShipmentsToVenue(fd);
    setVenueId(id);
    setVenueLabel(venues.find((vn) => vn.id === id)?.label ?? cluster.matchedVenue?.name ?? null);
    setBusy(null);
    router.refresh();
  }

  async function runDiscover(loadIds: string[], kind: "venue" | "show") {
    setBusy("discover");
    setError(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentIds: loadIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Web search failed.");
        return;
      }
      const dd = json.data as Discovered;
      setD(dd);
      setV({
        name: dd.venue_name ?? venueLabel ?? "",
        address: dd.venue_address ?? "",
        city: dd.venue_city ?? cluster.city ?? "",
        state: dd.venue_state ?? cluster.state ?? "",
      });
      setS({
        name: dd.show_name ?? "",
        year: dd.edition_year ? String(dd.edition_year) : "",
        website: dd.website_url ?? "",
        manual: dd.exhibitor_manual_url ?? "",
        list: dd.exhibitor_list_url ?? "",
        start: dd.show_start_date ?? "",
        end: dd.show_end_date ?? "",
        moveIn: dd.move_in_start ?? "",
        moveOut: dd.move_out_end ?? "",
      });
      setModal(kind === "venue" ? { kind: "venue" } : { kind: "show", loadIds });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function saveVenue() {
    if (!v.name.trim()) { setError("Venue name is required."); return; }
    setBusy("createvenue");
    setError(null);
    const fd = new FormData();
    fd.set("venue_name", v.name);
    fd.set("address", v.address);
    fd.set("city", v.city);
    fd.set("state", v.state);
    fd.set("shipment_ids", cluster.shipmentIds.join(","));
    const res = await createVenueAndLink(fd);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    if (res.venueId) { setVenueId(res.venueId); setVenueLabel(v.name); }
    setModal(null);
    router.refresh();
  }

  async function saveShow(loadIds: string[]) {
    if (!s.name.trim()) { setError("Show name is required."); return; }
    if (!venueId) { setError("Assign the venue first."); return; }
    setBusy("createvenue");
    setError(null);
    const fd = new FormData();
    fd.set("show_name", s.name);
    fd.set("edition_year", s.year);
    fd.set("venue_id", venueId);
    fd.set("website_url", s.website);
    fd.set("exhibitor_manual_url", s.manual);
    fd.set("exhibitor_list_url", s.list);
    fd.set("show_start_date", s.start);
    fd.set("show_end_date", s.end);
    fd.set("move_in_start", s.moveIn);
    fd.set("move_out_end", s.moveOut);
    fd.set("shipment_ids", loadIds.join(","));
    const res = await createShowAndLink(fd);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setModal(null);
    router.refresh();
  }

  const mv = cluster.matchedVenue;

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-base font-semibold text-slate-900">{heading}</h3>
        {cluster.addressLabel ? <span className="text-xs text-slate-400">{place}</span> : null}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {cluster.count} load{cluster.count === 1 ? "" : "s"}
        </span>
        {venueId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <Icon name="check" className="h-3 w-3" /> {venueLabel}
          </span>
        ) : mv ? (
          <span className="rounded-full bg-dts-blue/10 px-2 py-0.5 text-xs font-medium text-dts-blue">Matches {mv.name}</span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-500">
        {cluster.venueTexts.slice(0, 2).map((t, i) => (
          <div key={i} className="truncate">📍 {t}</div>
        ))}
        {cluster.exhibitors.length ? <div className="truncate">🏢 {cluster.exhibitors.slice(0, 6).join(", ")}</div> : null}
      </div>

      {/* Venue assignment */}
      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Venue</span>
          {cluster.needsVenue === 0 && venueId ? (
            <span className="text-xs text-emerald-600">All {cluster.count} loads linked to {venueLabel}.</span>
          ) : mv && !overrideVenue && venueId !== mv.id ? (
            <>
              <button type="button" onClick={() => linkVenueTo(mv.id)} disabled={busy !== null} className="rounded-lg bg-dts-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dts-blue/90 disabled:opacity-60">
                {busy === "venue" ? "Linking…" : `Use ${mv.name}`}
              </button>
              <button type="button" onClick={() => setOverrideVenue(true)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Change</button>
            </>
          ) : (
            <>
              <Combobox options={venues} value={pickVenue} onChange={setPickVenue} placeholder="Search your venues…" />
              <button type="button" onClick={() => linkVenueTo(pickVenue)} disabled={busy !== null || !pickVenue} className="rounded-lg bg-dts-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dts-blue/90 disabled:opacity-60">
                {busy === "venue" ? "Linking…" : "Link venue"}
              </button>
              <span className="text-xs text-slate-300">or</span>
              <button type="button" onClick={() => runDiscover(cluster.shipmentIds, "venue")} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-dts-maroon/30 bg-dts-maroon/5 px-3 py-1.5 text-xs font-medium text-dts-maroon transition hover:bg-dts-maroon/10 disabled:opacity-60">
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                {busy === "discover" ? "Searching…" : "Search the web"}
              </button>
            </>
          )}
        </div>
      </div>

      {error ? <p className="mt-3 rounded-lg bg-dts-maroon/5 px-3 py-2 text-xs text-dts-maroon">{error}</p> : null}

      {/* Show date groups */}
      <div className="mt-3 space-y-2">
        {cluster.groups.map((g) => (
          <ShowGroupRow
            key={g.id}
            group={g}
            venueAssigned={!!venueId}
            showsAtVenue={showsAtVenue}
            busyParent={busy !== null}
            onDiscover={() => runDiscover(g.loadIds, "show")}
            onLinked={() => router.refresh()}
          />
        ))}
      </div>

      {/* Web-discovery modal */}
      {modal
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onClick={() => setModal(null)} role="dialog" aria-modal="true">
              <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-lg font-semibold text-slate-900">
                    {modal.kind === "venue" ? "Create venue from web search" : "Create show from web search"}
                  </h2>
                  {d ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONF[d.confidence]}`}>AI: {d.confidence}</span> : null}
                </div>
                {d?.notes ? <p className="mt-1 text-xs text-slate-500">{d.notes}</p> : null}

                {modal.kind === "venue" ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Venue name" htmlFor="vn"><input id="vn" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} /></Field>
                    <Field label="Address" htmlFor="va"><input id="va" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} className={inputClass} /></Field>
                    <Field label="City" htmlFor="vc"><input id="vc" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} className={inputClass} /></Field>
                    <Field label="State" htmlFor="vs"><input id="vs" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} className={inputClass} /></Field>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Show name" htmlFor="sn"><input id="sn" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className={inputClass} /></Field>
                    <Field label="Edition year" htmlFor="sy"><input id="sy" value={s.year} onChange={(e) => setS({ ...s, year: e.target.value })} className={inputClass} /></Field>
                    <Field label="Website" htmlFor="sw" className="sm:col-span-2"><input id="sw" value={s.website} onChange={(e) => setS({ ...s, website: e.target.value })} className={inputClass} /></Field>
                    <Field label="Exhibitor manual URL" htmlFor="sm" className="sm:col-span-2"><input id="sm" value={s.manual} onChange={(e) => setS({ ...s, manual: e.target.value })} className={inputClass} /></Field>
                    <Field label="Show start" htmlFor="ss"><input id="ss" type="date" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} className={inputClass} /></Field>
                    <Field label="Show end" htmlFor="se"><input id="se" type="date" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} className={inputClass} /></Field>
                    <Field label="Move-in start" htmlFor="smi"><input id="smi" type="date" value={s.moveIn} onChange={(e) => setS({ ...s, moveIn: e.target.value })} className={inputClass} /></Field>
                    <Field label="Move-out end" htmlFor="smo"><input id="smo" type="date" value={s.moveOut} onChange={(e) => setS({ ...s, moveOut: e.target.value })} className={inputClass} /></Field>
                  </div>
                )}

                {d?.sources.length ? (
                  <div className="mt-3 text-xs text-slate-400">
                    Sources: {d.sources.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="mr-2 text-dts-blue hover:underline">[{i + 1}]</a>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setModal(null)} className="text-sm font-medium text-slate-500 hover:text-slate-900">Cancel</button>
                  <button
                    type="button"
                    onClick={() => (modal.kind === "venue" ? saveVenue() : saveShow(modal.loadIds))}
                    disabled={busy !== null}
                    className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60"
                  >
                    {busy === "createvenue" ? "Creating…" : modal.kind === "venue" ? "Create venue & link" : "Create show & link"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </Card>
  );
}

function ShowGroupRow({
  group,
  venueAssigned,
  showsAtVenue,
  busyParent,
  onDiscover,
  onLinked,
}: {
  group: ShowGroup;
  venueAssigned: boolean;
  showsAtVenue: { id: string; label: string }[];
  busyParent: boolean;
  onDiscover: () => void;
  onLinked: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(group.loadIds));
  const [open, setOpen] = useState(false);
  const [pickShow, setPickShow] = useState<string>(group.matchedShow?.id ?? "");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedIds = group.loadIds.filter((id) => selected.has(id));
  const allSel = selectedIds.length === group.loadIds.length;
  const ms = group.matchedShow;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function linkShowTo(id: string) {
    if (!id || !selectedIds.length) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("show_id", id);
    fd.set("shipment_ids", selectedIds.join(","));
    await linkShipmentsToShow(fd);
    setBusy(false);
    onLinked();
  }

  const disabled = busy || busyParent;

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <span className="text-[10px] text-slate-400">{open ? "▾" : "▸"}</span>
          {group.isAdvanceWarehouse ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
              <Icon name="alert" className="h-3 w-3" /> Advance warehouse
            </span>
          ) : (
            <span className="font-semibold text-slate-800">{group.label}</span>
          )}
          <span className="text-slate-400">· {group.count} load{group.count === 1 ? "" : "s"}</span>
        </button>
        {group.matchedShow ? (
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">Show: {group.matchedShow.name}</span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {group.needsShow === 0 ? (
            <span className="text-xs text-emerald-600">show linked</span>
          ) : ms && !override ? (
            <>
              <button type="button" onClick={() => linkShowTo(ms.id)} disabled={disabled || !selectedIds.length} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-60">
                {busy ? "Linking…" : `Use ${ms.name}`}
              </button>
              <button type="button" onClick={() => setOverride(true)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Change</button>
            </>
          ) : (
            <>
              {showsAtVenue.length ? (
                <>
                  <Combobox options={showsAtVenue} value={pickShow} onChange={setPickShow} placeholder="Search shows…" />
                  <button type="button" onClick={() => linkShowTo(pickShow)} disabled={disabled || !pickShow || !selectedIds.length} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-60">
                    {busy ? "Linking…" : "Link show"}
                  </button>
                  <span className="text-xs text-slate-300">or</span>
                </>
              ) : null}
              <button type="button" onClick={onDiscover} disabled={disabled || !venueAssigned} title={!venueAssigned ? "Assign the venue first" : undefined} className="inline-flex items-center gap-1.5 rounded-lg border border-dts-maroon/30 bg-dts-maroon/5 px-3 py-1.5 text-xs font-medium text-dts-maroon transition hover:bg-dts-maroon/10 disabled:opacity-60">
                <Icon name="sparkles" className="h-3.5 w-3.5" /> Search the web
              </button>
            </>
          )}
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-100">
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
            <span>{selectedIds.length} of {group.count} selected</span>
            <button type="button" onClick={() => setSelected(allSel ? new Set() : new Set(group.loadIds))} className="font-medium text-dts-blue hover:underline">
              {allSel ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {group.shipments.map((sh) => (
              <li key={sh.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 transition hover:bg-slate-50">
                  <input type="checkbox" checked={selected.has(sh.id)} onChange={() => toggle(sh.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <Link
                        href={`/shipments/${sh.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-dts-maroon hover:underline"
                      >
                        {sh.ref ? `Load ${sh.ref}` : "Open load"}
                      </Link>
                      {sh.booth ? <span className="text-slate-500">Booth {sh.booth}</span> : null}
                      {sh.date ? <span className="text-slate-400">{sh.date}</span> : null}
                      {sh.hasShow ? <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">show ✓</span> : null}
                    </span>
                    {sh.venueRaw ? <span className="mt-0.5 block truncate text-xs text-slate-500">📍 {sh.venueRaw}</span> : null}
                    {sh.exhibitor ? <span className="block truncate text-xs text-slate-400">🏢 {sh.exhibitor}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
