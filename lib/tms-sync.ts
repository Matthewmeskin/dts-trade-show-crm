import { createAdminClient } from "@/lib/supabase/admin";
import { parseLoad } from "@/lib/tms";

const TRACKING_BASE = "https://hyperion.dtsone.com/api/home/tracking";

/**
 * Pull live tracking for a single Brokerware load number and write the freight
 * fields onto the matching CRM shipment. Used for an instant refresh when a
 * coordinator saves a shipment with a load number, so they don't wait for the
 * n8n cron. Best-effort: returns false if the load isn't found or the call
 * fails, and never throws.
 *
 * Mirrors the /api/tms/shipments ingest: carriers are resolved by name
 * (find-or-create), and the exhibitor is resolved from the TMS customer name
 * (find-or-create) but only filled when the shipment isn't already linked, so
 * an operator's manual exhibitor/show link is never clobbered. Other
 * operator-owned fields (notes) are never touched.
 */
export async function syncLoadNumber(loadNumber: string): Promise<boolean> {
  const ref = loadNumber.trim();
  if (!ref) return false;

  let items: Record<string, unknown>[];
  try {
    const res = await fetch(
      `${TRACKING_BASE}?type=0&trackingnumbers=${encodeURIComponent(ref)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return false;
    const data = await res.json();
    items = Array.isArray(data) ? data : [];
  } catch {
    return false;
  }

  const parsed = parseLoad(items[0] ?? {});
  if (!parsed) return false;

  const supabase = createAdminClient();

  let carrier_id: string | undefined;
  if (parsed.carrierName) {
    const found = await supabase
      .from("carriers")
      .select("id")
      .ilike("carrier_name", parsed.carrierName)
      .limit(1)
      .maybeSingle();
    carrier_id =
      found.data?.id ??
      (
        await supabase
          .from("carriers")
          .insert({ carrier_name: parsed.carrierName })
          .select("id")
          .single()
      ).data?.id;
  }

  // Resolve the exhibitor from the TMS customer name, but only when this
  // shipment has no exhibitor yet — never overwrite a manual operator link
  // (and skip find-or-create entirely when already linked, so we don't mint
  // orphan exhibitor records).
  const { data: current } = await supabase
    .from("shipments")
    .select("exhibitor_id")
    .eq("tms_reference_id", parsed.ref)
    .maybeSingle();

  let exhibitor_id: string | undefined;
  if (!current?.exhibitor_id && parsed.customerName) {
    const found = await supabase
      .from("exhibitors")
      .select("id")
      .ilike("company_name", parsed.customerName)
      .limit(1)
      .maybeSingle();
    exhibitor_id =
      found.data?.id ??
      (
        await supabase
          .from("exhibitors")
          .insert({ company_name: parsed.customerName })
          .select("id")
          .single()
      ).data?.id;
  }

  const { error } = await supabase
    .from("shipments")
    .update({
      ...parsed.fields,
      ...(carrier_id ? { carrier_id } : {}),
      ...(exhibitor_id ? { exhibitor_id } : {}),
      tms_sync_status: "synced",
      tms_last_synced_at: new Date().toISOString(),
    })
    .eq("tms_reference_id", parsed.ref);

  return !error;
}
