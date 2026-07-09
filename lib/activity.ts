import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

/**
 * Append-only activity logging. Every mutating server action calls logActivity
 * so the /activity page can show who did what. Best-effort: a logging failure
 * must never break the action it's recording, so all errors are swallowed.
 */
export type ActivityEntry = {
  action: string; // created | updated | deleted | forced | unforced | status_changed
  entityType: string; // shipment | show | ...
  entityId?: string | null;
  entityLabel?: string | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
};

export async function logActivity(
  supabase: SupabaseClient<Database>,
  entry: ActivityEntry,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("activity_log").insert({
      user_id: user?.id ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      summary: entry.summary ?? null,
      details: (entry.details ?? null) as Json,
    });
  } catch {
    // Never let logging break the underlying action.
  }
}

/** "Exhibitor (load 12345)" for a shipment, best-effort. */
export async function shipmentLabel(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<string> {
  const { data } = await supabase
    .from("shipments")
    .select("tms_reference_id, exhibitor:exhibitors(company_name)")
    .eq("id", id)
    .maybeSingle();
  const name = data?.exhibitor?.company_name?.trim();
  const ref = data?.tms_reference_id;
  return [name || "Shipment", ref ? `(load ${ref})` : ""].filter(Boolean).join(" ");
}

/** Labels for the operator-owned shipment fields, for change summaries. */
export const SHIPMENT_FIELD_LABELS: Record<string, string> = {
  tms_reference_id: "load number",
  show_id: "show",
  exhibitor_id: "exhibitor",
  venue_id: "venue",
  destination_type: "destination type",
  direction: "direction",
  target_delivery_date: "target delivery",
  show_date: "show date",
  check_in_number: "check-in number",
  po_ref: "PO reference",
  shipper_number: "shipper number",
  billed_amount: "billed",
  cost_amount: "cost",
  special_requirements: "special requirements",
  notes: "notes",
};

/** Human labels used to badge each action on the activity page. */
export const ACTION_META: Record<string, { label: string; badge: string }> = {
  created: { label: "Created", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" },
  updated: { label: "Updated", badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25" },
  deleted: { label: "Deleted", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20" },
  forced: { label: "Forced", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20" },
  unforced: { label: "Unforced", badge: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20" },
  status_changed: { label: "Status", badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20" },
};
