import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/database.types";
import { extractCustomerId, isRoadshow, loadMoney } from "@/lib/tms";
import {
  classifyTradeShowLoads,
  type LoadInput,
  type LoadVerdict,
  type ClassifyResult,
} from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.TMS_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const str = (v: unknown) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

type RawLoad = Record<string, unknown>;
type Stop = { stopType?: string; fullAddress?: string; addressLine?: string };

type Normalized = {
  load_number: string;
  tms_status: string | null;
  mode: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  carrier_name: string | null;
  customer_name: string | null;
  tms_customer_id: string | null;
  po_ref: string | null;
  shipper_number: string | null;
  billed_amount: number | null;
  cost_amount: number | null;
  pieces: number | null;
  weight: number | null;
};

/** Accepts both GetLoads (stops[], carriers[], items[]) and Global Tracking shapes. */
function normalize(load: RawLoad): Normalized | null {
  const load_number = str(load.clientLoadId ?? load.loadId ?? load.load_number ?? load.load);
  if (!load_number) return null;

  const stops = Array.isArray(load.stops) ? (load.stops as Stop[]) : [];
  const pickStop = stops.find((s) => String(s.stopType ?? "").toLowerCase() === "pickup");
  const dropStop = stops.find((s) => ["drop", "delivery", "consignee"].includes(String(s.stopType ?? "").toLowerCase()));

  const carriers = Array.isArray(load.carriers) ? (load.carriers as Record<string, unknown>[]) : [];
  const primary = carriers.find((c) => c.isPrimary) ?? carriers[0];
  const items = Array.isArray(load.items) ? (load.items as Record<string, unknown>[]) : [];
  const sum = (k: string) => items.reduce((t, it) => t + (Number(it[k]) || 0), 0);
  // Money spans items[] (base freight) AND accessorials[] (surcharges), which
  // use different key names — sum both via the shared helper so a load's total
  // isn't just its first freight line.
  const money = loadMoney(load as Record<string, unknown>);

  return {
    load_number,
    tms_status: str(load.shipmentStatus ?? load.status),
    mode: str(load.serviceType ?? load.shipmentMode ?? load.mode),
    pickup_location: str(pickStop?.fullAddress ?? pickStop?.addressLine ?? load.pickupLocation ?? load.pickup_location),
    delivery_location: str(dropStop?.fullAddress ?? dropStop?.addressLine ?? load.deliveryLocation ?? load.delivery_location),
    carrier_name: str(primary?.carrierName ?? load.carrierName ?? load.carrier_name),
    customer_name: str(load.customerName ?? load.customer_name ?? load.customerCompany),
    tms_customer_id: extractCustomerId(load) ?? null,
    po_ref: str(load.poReference ?? load.po_ref ?? load.poReferenceNo),
    shipper_number: str(load.shipperNum ?? load.shipperNumber ?? load.shipper_number),
    billed_amount: money.billed ?? null,
    cost_amount: money.cost ?? null,
    pieces: items.length ? sum("pieces") || null : num(load.totalPieces ?? load.pieces),
    weight: items.length ? sum("weight") || null : num(load.totalWeight ?? load.weight),
  };
}

const KEYWORDS = [
  "convention", "conv ctr", "conv center", "expo", "exposition", "exhibit",
  "fairground", "fair ground", "civic center", "conference center", "booth",
  " hall", "pavilion", "tradeshow", "trade show", "mccormick", "javits",
  "mandalay", "sands expo", "caesars forum", "world center", "show site",
  "showsite", "c/o ", "convention center",
];

const MAX_AI = 120;

/** Classify loads in parallel chunks, merging verdicts; tolerant of a chunk failing. */
async function classifyInChunks(
  input: LoadInput[],
  venues: string[],
  size: number,
): Promise<ClassifyResult> {
  if (input.length <= size) return classifyTradeShowLoads(input, venues);
  const chunks: LoadInput[][] = [];
  for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size));
  const results = await Promise.all(chunks.map((c) => classifyTradeShowLoads(c, venues)));
  const verdicts: LoadVerdict[] = [];
  let sawOk = false;
  let firstBad: ClassifyResult | null = null;
  for (const r of results) {
    if (r.status === "ok") {
      sawOk = true;
      verdicts.push(...r.verdicts);
    } else if (!firstBad) {
      firstBad = r;
    }
  }
  if (!sawOk && firstBad) return firstBad;
  return { status: "ok", verdicts };
}

export async function POST(req: NextRequest) {
  if (!process.env.TMS_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Not configured (set TMS_WEBHOOK_SECRET)." }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const items: RawLoad[] = Array.isArray(body)
    ? (body as RawLoad[])
    : body && typeof body === "object" && Array.isArray((body as { loads?: unknown }).loads)
      ? ((body as { loads: RawLoad[] }).loads)
      : [];

  const supabase = createAdminClient();
  const { data: venueRows } = await supabase.from("venues").select("venue_name, city");
  const venueNames = (venueRows ?? []).map((v) => v.venue_name).filter(Boolean) as string[];
  const venueHints = [
    ...venueNames.map((n) => n.toLowerCase()),
    ...(venueRows ?? []).map((v) => v.city?.toLowerCase()).filter(Boolean) as string[],
  ];

  // Normalize + pre-filter to plausible loads (keyword or venue hit). Retail
  // roadshows are dropped up front — they are never trade-show freight.
  const normalized = items
    .filter((it) => !isRoadshow(it))
    .map(normalize)
    .filter((n): n is Normalized => !!n);
  const plausible = normalized.filter((n) => {
    const hay = `${n.pickup_location ?? ""} ${n.delivery_location ?? ""} ${n.mode ?? ""}`.toLowerCase();
    if (!hay.trim()) return false;
    if (KEYWORDS.some((k) => hay.includes(k))) return true;
    return venueHints.some((h) => h.length > 3 && hay.includes(h));
  });

  const toClassify = plausible.slice(0, MAX_AI);
  const aiInput: LoadInput[] = toClassify.map((n) => ({
    load_number: n.load_number,
    customer_name: n.customer_name,
    mode: n.mode,
    pickup_location: n.pickup_location,
    delivery_location: n.delivery_location,
  }));

  // Classify in parallel chunks so a large batch doesn't run past the function
  // budget (one big AI call for 120 loads can take over a minute).
  const result = await classifyInChunks(aiInput, venueNames, 40);
  if (result.status === "unconfigured") {
    return NextResponse.json({ ok: false, error: "AI not configured (set ANTHROPIC_API_KEY)." }, { status: 503 });
  }
  if (result.status === "error") {
    return NextResponse.json({ ok: false, error: result.message }, { status: 502 });
  }

  const byLoad = new Map(toClassify.map((n) => [n.load_number, n]));
  const candidates = result.verdicts.filter((v) => v.is_candidate && byLoad.has(v.load_number));

  // Preserve existing review_status (don't un-dismiss / re-open).
  const refs = candidates.map((c) => c.load_number);
  const existingReview = new Map<string, string>();
  if (refs.length) {
    const { data } = await supabase
      .from("tms_load_candidates")
      .select("load_number, review_status")
      .in("load_number", refs);
    for (const r of data ?? []) existingReview.set(r.load_number, r.review_status);
  }

  const now = new Date().toISOString();
  let stored = 0;
  for (const v of candidates) {
    const n = byLoad.get(v.load_number)!;
    const row: TablesInsert<"tms_load_candidates"> = {
      load_number: n.load_number,
      tms_status: n.tms_status,
      mode: n.mode,
      pickup_location: n.pickup_location,
      delivery_location: n.delivery_location,
      carrier_name: n.carrier_name,
      customer_name: n.customer_name,
      tms_customer_id: n.tms_customer_id,
      po_ref: n.po_ref,
      shipper_number: n.shipper_number,
      billed_amount: n.billed_amount,
      cost_amount: n.cost_amount,
      pieces: n.pieces,
      weight: n.weight,
      ai_is_candidate: true,
      ai_confidence: v.confidence,
      ai_reason: v.reason,
      matched_venue: v.venue,
      review_status: existingReview.get(n.load_number) ?? "new",
      updated_at: now,
    };
    let { error } = await supabase
      .from("tms_load_candidates")
      .upsert(row, { onConflict: "load_number" });
    // Self-heal if the tms_customer_id migration hasn't been applied yet: retry
    // without the unknown column so scans keep working (link just won't build).
    if (error?.code === "PGRST204" && "tms_customer_id" in row) {
      delete row.tms_customer_id;
      ({ error } = await supabase
        .from("tms_load_candidates")
        .upsert(row, { onConflict: "load_number" }));
    }
    if (!error) stored += 1;
  }

  return NextResponse.json({
    ok: true,
    received: normalized.length,
    plausible: plausible.length,
    classified: toClassify.length,
    truncated: plausible.length > MAX_AI,
    candidates: candidates.length,
    stored,
  });
}
