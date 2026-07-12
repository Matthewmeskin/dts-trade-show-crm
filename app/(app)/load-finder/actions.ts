"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncLoadNumber } from "@/lib/tms-sync";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import type { ShipmentDirection } from "@/lib/shipments";

const nowIso = () => new Date().toISOString();

// Convention-center signals used to decide which stop is the show site.
const VENUE_KEYWORDS = [
  "convention", "conv ctr", "conv center", "expo", "exhibit", "fairground",
  "civic center", "conference center", "pavilion", "arena", " center", " ctr", " hall",
];

/** Score how strongly a stop address looks like the matched venue. */
function venueScore(text: string, venueName: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const k of VENUE_KEYWORDS) if (t.includes(k)) score += 1;
  for (const tok of venueName.toLowerCase().split(/\s+/))
    if (tok.length > 3 && t.includes(tok)) score += 2;
  return score;
}

// Matches a US street address ("1850 West St", "800 W Katella Ave").
const STREET_RE =
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Za-z0-9'.\- ]*?\b(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|hwy|highway|ln|lane|pkwy|parkway|ct|court|pl|place|sq|square|ter|terrace|cir|circle|pike|plaza|loop|trail|trl)\b\.?/i;

/** Pull a clean street out of a messy stop line, dropping booth/suite noise. */
function cleanStreet(part: string): string | null {
  const street = part.match(STREET_RE)?.[0];
  if (street) return street.replace(/\s+/g, " ").trim();
  // No recognizable street — strip booth / suite / c-o / "- …" noise and use
  // whatever's left.
  const fallback = part
    .replace(/\bc\/o\b.*/i, "")
    .replace(/\bbooth\b.*/i, "")
    .replace(/\b(?:ste|suite|unit|#).*/i, "")
    .replace(/\s-\s.*/, "")
    .trim();
  return fallback || null;
}

/** Best-effort parse of "street…, city, ST zip" into venue address parts. */
function parseVenueAddress(text: string): { address: string | null; city: string | null; state: string | null } {
  const s = (text ?? "").trim();
  if (!s) return { address: null, city: null, state: null };
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  let state: string | null = null;
  if (parts.length) {
    const m = parts[parts.length - 1].match(/^([A-Za-z]{2})\s+\d{5}/);
    if (m) state = m[1].toUpperCase();
  }
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  const streetPart = parts.length >= 3 ? parts.slice(0, parts.length - 2).join(", ") : parts[0] ?? "";
  return { address: cleanStreet(streetPart), city, state };
}

/** Dismiss a candidate — it drops off the Load Finder. */
export async function dismissCandidate(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("tms_load_candidates")
    .update({ review_status: "dismissed", updated_at: nowIso() })
    .eq("id", id);
  revalidatePath("/load-finder");
}

type Sb = Awaited<ReturnType<typeof createClient>>;

/**
 * Convert one candidate into a tracked shipment: find-or-create the exhibitor
 * from the captured customer name, seed the operator-owned reference/financial
 * fields, and mark the candidate imported. Returns the shipment id and load
 * number. The live-tracking sync is left to the caller so bulk imports can run
 * the (slow, network-bound) syncs in parallel.
 */
async function importOne(
  supabase: Sb,
  id: string,
): Promise<{ shipmentId: string | null; loadNumber: string | null }> {
  // The candidate carries the GetLoads customer name, reference numbers, and
  // financials captured at scan time — the live tracking feed omits all of
  // these, so import is the only place we can seed them onto the shipment.
  const { data: cand } = await supabase
    .from("tms_load_candidates")
    .select(
      "load_number, customer_name, po_ref, shipper_number, billed_amount, cost_amount, matched_venue, pickup_location, delivery_location",
    )
    .eq("id", id)
    .maybeSingle();

  const load_number = cand?.load_number?.trim();
  if (!load_number) return { shipmentId: null, loadNumber: null };

  let exhibitor_id: string | null = null;
  const customerName = cand?.customer_name?.trim();
  if (customerName) {
    const { data: found } = await supabase
      .from("exhibitors")
      .select("id")
      .ilike("company_name", customerName)
      .limit(1)
      .maybeSingle();
    exhibitor_id =
      found?.id ??
      (
        await supabase
          .from("exhibitors")
          .insert({ company_name: customerName })
          .select("id")
          .single()
      ).data?.id ??
      null;
  }

  // Convention center: find-or-create the venue the AI matched, parsing its
  // address from whichever stop names it. The stop that names the venue also
  // tells us the direction — venue at delivery = move-in, at pickup = move-out.
  let venue_id: string | null = null;
  let direction: ShipmentDirection | null = null;
  const venueName = cand?.matched_venue?.trim();
  if (venueName) {
    const pickup = cand?.pickup_location ?? "";
    const delivery = cand?.delivery_location ?? "";
    const venueAtDelivery = venueScore(delivery, venueName) >= venueScore(pickup, venueName);
    direction = venueAtDelivery ? "move_in" : "move_out";

    const { data: foundVenue } = await supabase
      .from("venues")
      .select("id")
      .ilike("venue_name", venueName)
      .limit(1)
      .maybeSingle();
    if (foundVenue?.id) {
      venue_id = foundVenue.id;
    } else {
      const addr = parseVenueAddress(venueAtDelivery ? delivery : pickup);
      venue_id =
        (
          await supabase
            .from("venues")
            .insert({ venue_name: venueName, address: addr.address, city: addr.city, state: addr.state })
            .select("id")
            .single()
        ).data?.id ?? null;
    }
  }

  // Suggest the trade show: if exactly one active/upcoming show sits at this
  // venue, link it so its move-in dates & deadlines flow through. Never clobber.
  let show_id: string | null = null;
  if (venue_id) {
    const { data: showMatches } = await supabase
      .from("shows_with_status")
      .select("id, status")
      .eq("venue_id", venue_id)
      .in("status", ["active", "upcoming"]);
    if (showMatches && showMatches.length === 1) show_id = showMatches[0].id ?? null;
  }

  // Reference numbers + financials from the candidate (operator-owned: seed on
  // import, but never clobber a value already on the shipment).
  const po_ref = cand?.po_ref?.trim() || null;
  const shipper_number = cand?.shipper_number?.trim() || null;
  const billed_amount = cand?.billed_amount ?? null;
  const cost_amount = cand?.cost_amount ?? null;

  // Reuse an existing shipment for this load number, else create one.
  const { data: existing } = await supabase
    .from("shipments")
    .select("id, exhibitor_id, venue_id, show_id, direction, po_ref, shipper_number, billed_amount, cost_amount")
    .eq("tms_reference_id", load_number)
    .maybeSingle();

  let shipmentId = existing?.id ?? null;
  if (!shipmentId) {
    const { data: row } = await supabase
      .from("shipments")
      .insert({
        tms_reference_id: load_number,
        status: "booked",
        tms_sync_status: "manual",
        ...(exhibitor_id ? { exhibitor_id } : {}),
        ...(venue_id ? { venue_id } : {}),
        ...(show_id ? { show_id } : {}),
        ...(direction ? { direction } : {}),
        ...(po_ref ? { po_ref } : {}),
        ...(shipper_number ? { shipper_number } : {}),
        ...(billed_amount != null ? { billed_amount } : {}),
        ...(cost_amount != null ? { cost_amount } : {}),
      })
      .select("id")
      .single();
    shipmentId = row?.id ?? null;
  } else if (existing) {
    // Fill only the operator-owned fields the shipment doesn't already have.
    const patch: TablesUpdate<"shipments"> = {};
    if (exhibitor_id && !existing.exhibitor_id) patch.exhibitor_id = exhibitor_id;
    if (venue_id && !existing.venue_id) patch.venue_id = venue_id;
    if (show_id && !existing.show_id) patch.show_id = show_id;
    if (direction && !existing.direction) patch.direction = direction;
    if (po_ref && !existing.po_ref) patch.po_ref = po_ref;
    if (shipper_number && !existing.shipper_number) patch.shipper_number = shipper_number;
    if (billed_amount != null && existing.billed_amount == null) patch.billed_amount = billed_amount;
    if (cost_amount != null && existing.cost_amount == null) patch.cost_amount = cost_amount;
    if (Object.keys(patch).length) await supabase.from("shipments").update(patch).eq("id", shipmentId);
  }

  await supabase
    .from("tms_load_candidates")
    .update({ review_status: "imported", updated_at: nowIso() })
    .eq("id", id);

  return { shipmentId, loadNumber: load_number };
}

/** Turn a candidate into a tracked shipment and pull its live freight detail. */
export async function importCandidate(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { loadNumber } = await importOne(supabase, id);
  // Pull live tracking now so freight detail is populated immediately.
  if (loadNumber) await syncLoadNumber(loadNumber);

  revalidatePath("/load-finder");
  revalidatePath("/shipments");
  // Stay on the Load Finder (the imported candidate drops off the list) rather
  // than bouncing to the new shipment page.
  redirect("/load-finder?flash=added");
}

/** Bulk-import several candidates (checkbox selection or "Add all"). */
export async function importCandidates(fd: FormData) {
  const ids = [...new Set(fd.getAll("ids").map((v) => String(v)).filter(Boolean))];
  if (ids.length === 0) redirect("/load-finder");

  const supabase = await createClient();

  const { data: candRows } = await supabase
    .from("tms_load_candidates")
    .select(
      "id, load_number, customer_name, po_ref, shipper_number, billed_amount, cost_amount, matched_venue, pickup_location, delivery_location",
    )
    .in("id", ids);
  const candidates = (candRows ?? []).filter((c) => c.load_number?.trim());
  if (candidates.length === 0) redirect("/load-finder");

  // Resolve exhibitors and venues in bulk (case-insensitive find-or-create) —
  // far fewer round-trips than resolving each candidate one at a time.
  const [{ data: exhRows }, { data: venueRows }] = await Promise.all([
    supabase.from("exhibitors").select("id, company_name"),
    supabase.from("venues").select("id, venue_name"),
  ]);
  const exhByName = new Map((exhRows ?? []).map((e) => [e.company_name.trim().toLowerCase(), e.id]));
  const venueByName = new Map((venueRows ?? []).map((v) => [v.venue_name.trim().toLowerCase(), v.id]));

  // Create any missing exhibitors in one insert.
  const newExh = [
    ...new Set(
      candidates
        .map((c) => c.customer_name?.trim())
        .filter((n): n is string => !!n && !exhByName.has(n.toLowerCase())),
    ),
  ];
  if (newExh.length) {
    const { data: created } = await supabase
      .from("exhibitors")
      .insert(newExh.map((company_name) => ({ company_name })))
      .select("id, company_name");
    for (const e of created ?? []) exhByName.set(e.company_name.trim().toLowerCase(), e.id);
  }

  // Per-candidate direction (venue at delivery = move-in, at pickup = move-out)
  // and the set of venues to create.
  const dirByLoad = new Map<string, ShipmentDirection | null>();
  const toCreateVenue = new Map<string, { name: string } & ReturnType<typeof parseVenueAddress>>();
  for (const c of candidates) {
    const vname = c.matched_venue?.trim() || null;
    if (!vname) {
      dirByLoad.set(c.load_number!.trim(), null);
      continue;
    }
    const pickup = c.pickup_location ?? "";
    const delivery = c.delivery_location ?? "";
    const atDelivery = venueScore(delivery, vname) >= venueScore(pickup, vname);
    dirByLoad.set(c.load_number!.trim(), atDelivery ? "move_in" : "move_out");
    const key = vname.toLowerCase();
    if (!venueByName.has(key) && !toCreateVenue.has(key)) {
      toCreateVenue.set(key, { name: vname, ...parseVenueAddress(atDelivery ? delivery : pickup) });
    }
  }
  if (toCreateVenue.size) {
    const { data: created } = await supabase
      .from("venues")
      .insert([...toCreateVenue.values()].map((v) => ({ venue_name: v.name, address: v.address, city: v.city, state: v.state })))
      .select("id, venue_name");
    for (const v of created ?? []) venueByName.set(v.venue_name.trim().toLowerCase(), v.id);
  }

  // Suggest a show per venue: link only when exactly one active/upcoming show.
  const venueIds = [
    ...new Set(
      candidates
        .map((c) => (c.matched_venue ? venueByName.get(c.matched_venue.trim().toLowerCase()) : undefined))
        .filter((x): x is string => !!x),
    ),
  ];
  const showByVenue = new Map<string, string>();
  if (venueIds.length) {
    const { data: showRows } = await supabase
      .from("shows_with_status")
      .select("id, venue_id, status")
      .in("venue_id", venueIds)
      .in("status", ["active", "upcoming"]);
    const byVenue = new Map<string, string[]>();
    for (const s of showRows ?? []) {
      if (!s.venue_id || !s.id) continue;
      (byVenue.get(s.venue_id) ?? byVenue.set(s.venue_id, []).get(s.venue_id)!).push(s.id);
    }
    for (const [vid, list] of byVenue) if (list.length === 1) showByVenue.set(vid, list[0]);
  }

  // Existing shipments for these load numbers (one query).
  const loadNumbers = candidates.map((c) => c.load_number!.trim());
  const { data: existingRows } = await supabase
    .from("shipments")
    .select("id, tms_reference_id, exhibitor_id, venue_id, show_id, direction, po_ref, shipper_number, billed_amount, cost_amount")
    .in("tms_reference_id", loadNumbers);
  const existingByLoad = new Map((existingRows ?? []).map((r) => [r.tms_reference_id!, r]));

  // Build one bulk insert for new shipments; fill-empty updates for existing.
  const inserts: TablesInsert<"shipments">[] = [];
  const updates: PromiseLike<unknown>[] = [];
  for (const c of candidates) {
    const load_number = c.load_number!.trim();
    const exhibitor_id = c.customer_name?.trim() ? exhByName.get(c.customer_name.trim().toLowerCase()) ?? null : null;
    const venue_id = c.matched_venue ? venueByName.get(c.matched_venue.trim().toLowerCase()) ?? null : null;
    const show_id = venue_id ? showByVenue.get(venue_id) ?? null : null;
    const direction = dirByLoad.get(load_number) ?? null;
    const po_ref = c.po_ref?.trim() || null;
    const shipper_number = c.shipper_number?.trim() || null;
    const billed_amount = c.billed_amount ?? null;
    const cost_amount = c.cost_amount ?? null;

    const existing = existingByLoad.get(load_number);
    if (!existing) {
      inserts.push({
        tms_reference_id: load_number,
        status: "booked",
        tms_sync_status: "manual",
        ...(exhibitor_id ? { exhibitor_id } : {}),
        ...(venue_id ? { venue_id } : {}),
        ...(show_id ? { show_id } : {}),
        ...(direction ? { direction } : {}),
        ...(po_ref ? { po_ref } : {}),
        ...(shipper_number ? { shipper_number } : {}),
        ...(billed_amount != null ? { billed_amount } : {}),
        ...(cost_amount != null ? { cost_amount } : {}),
      });
    } else {
      const patch: TablesUpdate<"shipments"> = {};
      if (exhibitor_id && !existing.exhibitor_id) patch.exhibitor_id = exhibitor_id;
      if (venue_id && !existing.venue_id) patch.venue_id = venue_id;
      if (show_id && !existing.show_id) patch.show_id = show_id;
      if (direction && !existing.direction) patch.direction = direction;
      if (po_ref && !existing.po_ref) patch.po_ref = po_ref;
      if (shipper_number && !existing.shipper_number) patch.shipper_number = shipper_number;
      if (billed_amount != null && existing.billed_amount == null) patch.billed_amount = billed_amount;
      if (cost_amount != null && existing.cost_amount == null) patch.cost_amount = cost_amount;
      if (Object.keys(patch).length) updates.push(supabase.from("shipments").update(patch).eq("id", existing.id));
    }
  }

  if (inserts.length) await supabase.from("shipments").insert(inserts);
  if (updates.length) await Promise.all(updates);

  await supabase
    .from("tms_load_candidates")
    .update({ review_status: "imported", updated_at: nowIso() })
    .in("id", ids);

  // Live-tracking syncs in parallel — the one remaining per-load network call.
  await Promise.allSettled(loadNumbers.map((ln) => syncLoadNumber(ln)));

  revalidatePath("/load-finder");
  revalidatePath("/shipments");
  redirect("/load-finder?flash=imported");
}

/** Kick off an on-demand scan by triggering the n8n scanner webhook. */
export async function triggerScan() {
  const url = process.env.N8N_SCAN_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, { method: "POST", cache: "no-store" });
    } catch {
      // n8n runs asynchronously; failures surface on its side.
    }
  }
  redirect(`/load-finder?flash=${url ? "scan" : "scan_unconfigured"}`);
}
