"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Field, inputClass } from "@/components/form";
import { createVenueAndLink, createShowAndLink, linkShipmentsToVenue } from "./actions";

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

export type Cluster = {
  city: string | null;
  state: string | null;
  shipmentIds: string[];
  count: number;
  venueTexts: string[];
  exhibitors: string[];
  dateHints: string[];
  matchedVenue: { id: string; name: string } | null;
  needsVenue: number;
  needsShow: number;
  shipments: ClusterShipment[];
};

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

export function SuggestionList({ clusters }: { clusters: Cluster[] }) {
  return (
    <div className="space-y-4">
      {clusters.map((c, i) => (
        <ClusterCard key={i} cluster={c} />
      ))}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const router = useRouter();
  const place = [cluster.city, cluster.state].filter(Boolean).join(", ") || "Unknown location";

  const [busy, setBusy] = useState<null | "discover" | "venue" | "show" | "link">(null);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Discovered | null>(null);
  // venue id once matched or created — required before a show can be created.
  const [venueId, setVenueId] = useState<string | null>(cluster.matchedVenue?.id ?? null);
  const [venueLabel, setVenueLabel] = useState<string | null>(cluster.matchedVenue?.name ?? null);

  // editable fields (seeded by AI discovery)
  const [v, setV] = useState({ name: "", address: "", city: cluster.city ?? "", state: cluster.state ?? "" });
  const [s, setS] = useState({
    name: "", year: "", website: "", manual: "", list: "",
    start: "", end: "", moveIn: "", moveOut: "",
  });
  const [open, setOpen] = useState(false);

  // Which loads in this cluster the actions apply to. One city often holds
  // several different shows, so the operator can narrow the set before linking.
  const [selected, setSelected] = useState<Set<string>>(new Set(cluster.shipmentIds));
  const [showLoads, setShowLoads] = useState(false);

  const selectedIds = cluster.shipmentIds.filter((id) => selected.has(id));
  const idsCsv = selectedIds.join(",");
  const allSelected = selectedIds.length === cluster.shipmentIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function setAll(on: boolean) {
    setSelected(on ? new Set(cluster.shipmentIds) : new Set());
  }

  async function discover() {
    if (!selectedIds.length) { setError("Select at least one load first."); return; }
    setBusy("discover");
    setError(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentIds: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Discovery failed.");
        return;
      }
      const dd = json.data as Discovered;
      setD(dd);
      setOpen(true);
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
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function linkMatched() {
    if (!cluster.matchedVenue) return;
    setBusy("link");
    const fd = new FormData();
    fd.set("venue_id", cluster.matchedVenue.id);
    fd.set("shipment_ids", idsCsv);
    await linkShipmentsToVenue(fd);
    setBusy(null);
    router.refresh();
  }

  async function saveVenue() {
    if (!v.name.trim()) { setError("Venue name is required."); return; }
    setBusy("venue");
    setError(null);
    const fd = new FormData();
    fd.set("venue_name", v.name);
    fd.set("address", v.address);
    fd.set("city", v.city);
    fd.set("state", v.state);
    fd.set("shipment_ids", idsCsv);
    const res = await createVenueAndLink(fd);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    if (res.venueId) { setVenueId(res.venueId); setVenueLabel(v.name); }
    router.refresh();
  }

  async function saveShow() {
    if (!s.name.trim()) { setError("Show name is required."); return; }
    if (!venueId) { setError("Create or link the venue first."); return; }
    setBusy("show");
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
    fd.set("shipment_ids", idsCsv);
    const res = await createShowAndLink(fd);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-semibold text-slate-900">{place}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {cluster.count} shipment{cluster.count === 1 ? "" : "s"}
            </span>
            {cluster.matchedVenue ? (
              <span className="rounded-full bg-dts-blue/10 px-2 py-0.5 text-xs font-medium text-dts-blue">
                Matches {cluster.matchedVenue.name}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {cluster.needsVenue > 0 ? `${cluster.needsVenue} need a venue` : "venue linked"}
            {" · "}
            {cluster.needsShow > 0 ? `${cluster.needsShow} need a show` : "show linked"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLoads((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-[10px] text-slate-400">{showLoads ? "▾" : "▸"}</span>
            {showLoads ? "Hide loads" : `Review ${cluster.count} load${cluster.count === 1 ? "" : "s"}`}
          </button>
          {cluster.matchedVenue && cluster.needsVenue > 0 ? (
            <button
              type="button"
              onClick={linkMatched}
              disabled={busy !== null || !selectedIds.length}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "link" ? "Linking…" : `Link ${selectedIds.length} to ${cluster.matchedVenue.name}`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={discover}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dts-maroon/30 bg-dts-maroon/5 px-3 py-1.5 text-xs font-medium text-dts-maroon transition hover:bg-dts-maroon/10 disabled:opacity-60"
          >
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            {busy === "discover" ? "Searching…" : d ? "Re-run AI" : "Discover with AI"}
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {cluster.venueTexts.slice(0, 3).map((t, i) => (
          <div key={i} className="truncate">📍 {t}</div>
        ))}
        {cluster.exhibitors.length ? (
          <div className="truncate">🏢 {cluster.exhibitors.slice(0, 6).join(", ")}</div>
        ) : null}
        {cluster.dateHints.length ? <div>🗓 {cluster.dateHints.join(" · ")}</div> : null}
      </div>

      {showLoads ? (
        <div className="mt-3 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-medium text-slate-600">
              {selectedIds.length} of {cluster.count} selected
            </span>
            <button
              type="button"
              onClick={() => setAll(!allSelected)}
              className="text-xs font-medium text-dts-blue hover:underline"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {cluster.shipments.map((sh) => (
              <li key={sh.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.has(sh.id)}
                    onChange={() => toggle(sh.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {sh.ref ? <span className="font-medium text-slate-700">Load {sh.ref}</span> : null}
                      {sh.booth ? <span className="text-slate-500">Booth {sh.booth}</span> : null}
                      {sh.date ? <span className="text-slate-400">{sh.date}</span> : null}
                      {sh.hasVenue ? <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">venue ✓</span> : null}
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

      {error ? (
        <p className="mt-3 rounded-lg bg-dts-maroon/5 px-3 py-2 text-xs text-dts-maroon">{error}</p>
      ) : null}

      {open && d ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${CONF[d.confidence]}`}>
              AI confidence: {d.confidence}
            </span>
            {d.notes ? <span className="text-slate-500">{d.notes}</span> : null}
          </div>

          {/* Venue */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Venue</h4>
              {venueId ? <span className="text-xs text-emerald-600">✓ {venueLabel}</span> : null}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Venue name" htmlFor="vn"><input id="vn" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} /></Field>
              <Field label="Address" htmlFor="va"><input id="va" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} className={inputClass} /></Field>
              <Field label="City" htmlFor="vc"><input id="vc" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} className={inputClass} /></Field>
              <Field label="State" htmlFor="vs"><input id="vs" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} className={inputClass} /></Field>
            </div>
            <button type="button" onClick={saveVenue} disabled={busy !== null || !selectedIds.length} className="mt-3 rounded-lg bg-dts-maroon px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60">
              {busy === "venue" ? "Creating…" : `Create venue & link ${selectedIds.length}`}
            </button>
          </div>

          {/* Show */}
          <div className="rounded-lg border border-slate-200 p-3">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Show</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Show name" htmlFor="sn"><input id="sn" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className={inputClass} /></Field>
              <Field label="Edition year" htmlFor="sy"><input id="sy" value={s.year} onChange={(e) => setS({ ...s, year: e.target.value })} className={inputClass} /></Field>
              <Field label="Website" htmlFor="sw" className="sm:col-span-2"><input id="sw" value={s.website} onChange={(e) => setS({ ...s, website: e.target.value })} className={inputClass} /></Field>
              <Field label="Exhibitor manual URL" htmlFor="sm" className="sm:col-span-2"><input id="sm" value={s.manual} onChange={(e) => setS({ ...s, manual: e.target.value })} className={inputClass} /></Field>
              <Field label="Exhibitor list URL" htmlFor="sl" className="sm:col-span-2"><input id="sl" value={s.list} onChange={(e) => setS({ ...s, list: e.target.value })} className={inputClass} /></Field>
              <Field label="Show start" htmlFor="ss"><input id="ss" type="date" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} className={inputClass} /></Field>
              <Field label="Show end" htmlFor="se"><input id="se" type="date" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} className={inputClass} /></Field>
              <Field label="Move-in start" htmlFor="smi"><input id="smi" type="date" value={s.moveIn} onChange={(e) => setS({ ...s, moveIn: e.target.value })} className={inputClass} /></Field>
              <Field label="Move-out end" htmlFor="smo"><input id="smo" type="date" value={s.moveOut} onChange={(e) => setS({ ...s, moveOut: e.target.value })} className={inputClass} /></Field>
            </div>
            <button type="button" onClick={saveShow} disabled={busy !== null || !venueId || !selectedIds.length} className="mt-3 rounded-lg bg-dts-maroon px-3 py-1.5 text-xs font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60" title={!venueId ? "Create or link the venue first" : undefined}>
              {busy === "show" ? "Creating…" : `Create show & link ${selectedIds.length}`}
            </button>
          </div>

          {d.sources.length ? (
            <div className="text-xs text-slate-400">
              Sources: {d.sources.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="mr-2 text-dts-blue hover:underline">[{i + 1}]</a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
