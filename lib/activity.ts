import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { IconName } from "@/components/icons";

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
  booth_number: "booth number",
  pieces: "pieces",
  consignee_company: "ship-to company",
  consignee_contact: "ship-to contact",
  consignee_phone: "ship-to phone",
  consignee_street1: "ship-to street",
  consignee_street2: "ship-to street 2",
  consignee_city: "ship-to city",
  consignee_state: "ship-to state",
  consignee_zip: "ship-to ZIP",
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

/**
 * Per entity type: display label, icon, and how to link to the record. Drives
 * the /activity feed and its "entity type" filter. Keep keys in sync with the
 * `entityType` strings passed to logActivity.
 */
export const ENTITY_META: Record<
  string,
  { label: string; plural: string; icon: IconName; href?: (id: string) => string }
> = {
  shipment: { label: "Shipment", plural: "Shipments", icon: "shipments", href: (id) => `/shipments/${id}` },
  exhibitor: { label: "Exhibitor", plural: "Exhibitors", icon: "exhibitors", href: (id) => `/exhibitors/${id}` },
  show: { label: "Show", plural: "Shows", icon: "shows", href: (id) => `/shows/${id}` },
  contact: { label: "Contact", plural: "Contacts", icon: "contacts", href: (id) => `/contacts/${id}` },
  carrier: { label: "Carrier", plural: "Carriers", icon: "carriers", href: (id) => `/carriers/${id}` },
  venue: { label: "Venue", plural: "Venues", icon: "venues", href: (id) => `/venues/${id}` },
  task: { label: "Task", plural: "Tasks", icon: "tasks" },
  user: { label: "User", plural: "Users", icon: "users", href: () => `/users` },
};

/**
 * Generic before/after diff for a mutation. Compares every key in the payload
 * against a DB snapshot (stringified, so nulls/numbers/enums compare cleanly)
 * so a change is never missed even if a field lacks a friendly label. `labels`
 * only prettifies the summary; unlabeled keys fall back to the humanized key.
 */
export function diffPayload(
  before: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown>,
  labels: Record<string, string> = {},
): { keys: string[]; summary: string | null } {
  const b = before ?? {};
  const keys = Object.keys(payload).filter(
    (k) => String(b[k] ?? "") !== String(payload[k] ?? ""),
  );
  if (!keys.length) return { keys, summary: null };
  const names = keys.map((k) => labels[k] ?? k.replace(/_/g, " "));
  return { keys, summary: `Changed ${names.join(", ")}` };
}

export const EXHIBITOR_FIELD_LABELS: Record<string, string> = {
  company_name: "company name",
  industry: "industry",
  website: "website",
  owner_rep: "owner/rep",
  sales_status: "status",
  status_reason: "status reason",
  priority_tier: "tier",
  primary_contact_name: "primary contact",
  primary_contact_title: "contact title",
  primary_contact_email: "contact email",
  primary_contact_phone: "contact phone",
  secondary_contacts: "secondary contacts",
  freight_profile_notes: "freight notes",
  general_notes: "notes",
};

export const CONTACT_FIELD_LABELS: Record<string, string> = {
  first_name: "first name",
  last_name: "last name",
  title: "title",
  company: "company",
  email: "email",
  phone: "phone",
  contact_type: "type",
  notes: "notes",
  show_id: "linked show",
  exhibitor_id: "linked exhibitor",
  venue_id: "linked venue",
  carrier_id: "linked carrier",
};

export const CARRIER_FIELD_LABELS: Record<string, string> = {
  carrier_name: "name",
  trade_show_notes: "trade-show notes",
  bill_to_company: "billing company",
  bill_to_address1: "billing address",
  bill_to_address2: "billing address 2",
  bill_to_city: "billing city",
  bill_to_state: "billing state",
  bill_to_zip: "billing zip",
  bill_to_phone: "billing phone",
};

export const VENUE_FIELD_LABELS: Record<string, string> = {
  venue_name: "name",
  city: "city",
  state: "state",
  address: "address",
  dock_notes: "dock notes",
  union_rules: "union rules",
  delivery_restrictions: "delivery restrictions",
  parking_and_staging_notes: "parking & staging notes",
  general_notes: "notes",
};

export const TASK_FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  due_date: "due date",
  assigned_to: "assignee",
  status: "status",
  priority: "priority",
  related_show_id: "linked show",
  related_exhibitor_id: "linked exhibitor",
  related_shipment_id: "linked shipment",
  related_carrier_id: "linked carrier",
  related_venue_id: "linked venue",
};

export const SHOW_FIELD_LABELS: Record<string, string> = {
  show_name: "name",
  edition_year: "year",
  city: "city",
  state: "state",
  move_in_start: "move-in start",
  move_in_end: "move-in end",
  move_out_start: "move-out start",
  move_out_end: "move-out end",
  show_start_date: "show start",
  show_end_date: "show end",
  venue_id: "venue",
  status: "status",
};
