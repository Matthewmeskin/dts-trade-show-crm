import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLoad } from "@/lib/tms";
import type { TablesInsert } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.TMS_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * TMS / BrokerWareLite ingest. n8n POSTs load payloads here; each is matched to
 * a CRM shipment by load number (tms_reference_id) and upserted. Existing
 * operator linking (show/exhibitor) is preserved on update. New load numbers
 * create an unlinked shipment for an operator to attach later.
 *
 * Auth: `Authorization: Bearer <TMS_WEBHOOK_SECRET>`.
 * Body: a single object, an array, or `{ "shipments": [...] }`.
 */
export async function POST(req: NextRequest) {
  if (!process.env.TMS_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "TMS ingest is not configured (set TMS_WEBHOOK_SECRET)." },
      { status: 503 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const items: Record<string, unknown>[] = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { shipments?: unknown }).shipments)
      ? ((body as { shipments: Record<string, unknown>[] }).shipments)
      : body && typeof body === "object"
        ? [body as Record<string, unknown>]
        : [];

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "No shipment payload provided" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const parsed = items.map(parseLoad);

  // Which load numbers already exist? (drives inserted vs updated reporting)
  const refs = parsed.filter(Boolean).map((p) => p!.ref);
  const existing = new Set<string>();
  if (refs.length) {
    const { data } = await supabase.from("shipments").select("tms_reference_id").in("tms_reference_id", refs);
    for (const r of data ?? []) if (r.tms_reference_id) existing.add(r.tms_reference_id);
  }

  // Resolve carriers by name (find-or-create), case-insensitive.
  const carrierIds = new Map<string, string>();
  const carrierNames = [...new Set(parsed.filter((p) => p?.carrierName).map((p) => p!.carrierName!))];
  for (const name of carrierNames) {
    const found = await supabase.from("carriers").select("id").ilike("carrier_name", name).limit(1).maybeSingle();
    if (found.data?.id) {
      carrierIds.set(name.toLowerCase(), found.data.id);
    } else {
      const created = await supabase.from("carriers").insert({ carrier_name: name }).select("id").single();
      if (created.data?.id) carrierIds.set(name.toLowerCase(), created.data.id);
    }
  }

  const now = new Date().toISOString();
  const results: { tms_reference_id: string | null; action: "inserted" | "updated" | "error"; error?: string }[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (!p) {
      results.push({ tms_reference_id: null, action: "error", error: "Missing load number" });
      continue;
    }
    const carrier_id = p.carrierName ? carrierIds.get(p.carrierName.toLowerCase()) : undefined;
    // Note: show_id / exhibitor_id are intentionally NOT set here — operator
    // linking is preserved on update, and stays null on a fresh insert.
    const row: TablesInsert<"shipments"> = {
      tms_reference_id: p.ref,
      ...p.fields,
      ...(carrier_id ? { carrier_id } : {}),
      tms_sync_status: "synced",
      tms_last_synced_at: now,
    };

    const { error } = await supabase
      .from("shipments")
      .upsert(row, { onConflict: "tms_reference_id" });

    if (error) {
      results.push({ tms_reference_id: p.ref, action: "error", error: error.message });
    } else {
      results.push({ tms_reference_id: p.ref, action: existing.has(p.ref) ? "updated" : "inserted" });
    }
  }

  const inserted = results.filter((r) => r.action === "inserted").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const errors = results.filter((r) => r.action === "error").length;

  return NextResponse.json({
    ok: errors === 0,
    processed: results.length,
    inserted,
    updated,
    errors,
    results,
  });
}
