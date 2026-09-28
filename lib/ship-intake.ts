import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { stageAfterExhibitor } from "@/lib/ship-status";

/**
 * GSC Shipping Center requests, as the pull receives them from the public
 * project (pull_confirmed_requests_signed), turned into inbox rows. Pure, so
 * it is tested without a database.
 */

export type PulledLeg = {
  id: string;
  direction: "inbound" | "outbound";
  seq: number;
  place_name: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  location_type: string | null;
  liftgate: boolean;
  inside: boolean;
  ready_date: string | null;
  inbound_to: "advance_warehouse" | "direct" | null;
  own_carrier: boolean;
  deliver_by: string | null;
  onsite_contact_name: string | null;
  onsite_contact_mobile: string | null;
  return_to_warehouse: boolean;
  pieces: number | null;
  weight_lbs: number | null;
  packaging: string | null;
  largest_l_in: number | null;
  largest_w_in: number | null;
  largest_h_in: number | null;
  description: string | null;
  hazmat: boolean;
  /** Slice 5: the leg's status on the exhibitor's side, and when they approved. */
  status?: string;
  approved_at?: string | null;
};

export type PulledChange = { id: number; message: string; at: string };

export type PulledRequest = {
  id: string;
  public_ref: string;
  /** Slice 5: bumps on every exhibitor action; the ack carries it back. */
  version?: number;
  status?: "confirmed" | "cancelled";
  changes?: PulledChange[];
  partner_id: string;
  show_id: string;
  show: Record<string, unknown> | null;
  company: string | null;
  contact_name: string | null;
  email: string | null;
  mobile: string | null;
  booth: string | null;
  booth_tbd: boolean;
  on_behalf_of: string | null;
  declared_value: number | string | null;
  wants_coverage: boolean;
  marketing_consent: boolean;
  marketing_consent_text: string | null;
  terms_accepted_at: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  legs: PulledLeg[];
};

export type Known = {
  partners: Set<string>;
  shows: Set<string>;
  /** "partnerId:showId" for every ship_shows row. */
  shipShows: Set<string>;
};

/** "Outbound" or "Inbound 2": how a leg is named everywhere staff see it. */
export function legName(direction: string, seq: number, inboundCount = 2): string {
  if (direction === "outbound") return "Outbound";
  return inboundCount > 1 ? `Inbound ${seq}` : "Inbound";
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** What a person should look at before quoting, in plain words. */
export function problemsFor(r: PulledRequest, known: Known): string[] {
  const out: string[] = [];
  if (!known.partners.has(r.partner_id)) out.push("The GSC on this request is not in the CRM.");
  if (!known.shows.has(r.show_id)) out.push("The show on this request is no longer in the CRM.");
  else if (known.partners.has(r.partner_id) && !known.shipShows.has(`${r.partner_id}:${r.show_id}`)) {
    out.push("This GSC does not run this show through its Shipping Center in the CRM.");
  }
  if (!r.legs.length) out.push("No shipments on this request.");
  const inbound = r.legs.filter((l) => l.direction === "inbound").length;
  for (const l of r.legs) {
    const name = legName(l.direction, l.seq, inbound);
    if (l.hazmat) out.push(`${name}: marked hazardous. Review before quoting.`);
    if (l.location_type === "residential" || l.location_type === "limited_access") {
      out.push(`${name}: ${l.location_type === "residential" ? "a residence" : "limited access"}. Check accessorials.`);
    }
  }
  if (r.booth_tbd) out.push("Booth not assigned yet.");
  if (r.wants_coverage) {
    const v = num(r.declared_value);
    out.push(`Wants a cargo coverage quote${v ? ` (declared value $${v.toLocaleString("en-US")})` : ""}.`);
  }
  return out;
}

export function inboxRow(r: PulledRequest, known: Known): TablesInsert<"ship_request_inbox"> {
  return {
    public_request_id: r.id,
    public_ref: r.public_ref,
    partner_id: known.partners.has(r.partner_id) ? r.partner_id : null,
    show_id: known.shows.has(r.show_id) ? r.show_id : null,
    show_snapshot: (r.show ?? {}) as TablesInsert<"ship_request_inbox">["show_snapshot"],
    company: r.company,
    contact_name: r.contact_name,
    email: r.email,
    mobile: r.mobile,
    booth: r.booth,
    booth_tbd: r.booth_tbd,
    on_behalf_of: r.on_behalf_of,
    declared_value: num(r.declared_value),
    wants_coverage: r.wants_coverage,
    marketing_consent: r.marketing_consent,
    marketing_consent_text: r.marketing_consent ? r.marketing_consent_text : null,
    terms_accepted_at: r.terms_accepted_at,
    submitted_at: r.created_at,
    confirmed_at: r.confirmed_at,
    problems: problemsFor(r, known),
    exhibitor_version: r.version ?? 1,
    ...(r.status === "cancelled"
      ? {
          closed: "cancelled",
          closed_note: "Cancelled by the exhibitor before anything was booked.",
          closed_at: new Date().toISOString(),
          exhibitor_cancelled_at: new Date().toISOString(),
          pushed_closed: true,
        }
      : {}),
  };
}

/**
 * A newer version of a request already in the inbox: what the exhibitor can
 * change (booth, and cancelling), and the problems recomputed. A request
 * staff already closed stays as staff left it.
 */
export function exhibitorPatch(
  r: PulledRequest,
  known: Known,
  current: { closed: string | null },
): TablesUpdate<"ship_request_inbox"> {
  const now = new Date().toISOString();
  return {
    booth: r.booth,
    booth_tbd: r.booth_tbd,
    exhibitor_version: r.version ?? 1,
    problems: problemsFor(r, known),
    ...(r.status === "cancelled" && !current.closed
      ? {
          closed: "cancelled",
          closed_note: "Cancelled by the exhibitor before anything was booked.",
          closed_at: now,
          exhibitor_cancelled_at: now,
          pushed_closed: true,
        }
      : {}),
  };
}

/** The exhibitor-editable fields of a leg, and its stage after their action. */
export function legPatch(l: PulledLeg, crmStage: string): TablesUpdate<"ship_request_legs"> {
  const next = stageAfterExhibitor(crmStage, l.status ?? "requested");
  return {
    pieces: l.pieces,
    weight_lbs: l.weight_lbs,
    ready_date: l.ready_date,
    deliver_by: l.deliver_by,
    onsite_contact_name: l.onsite_contact_name,
    onsite_contact_mobile: l.onsite_contact_mobile,
    stage: next.stage,
    ...(next.approved ? { approved_at: l.approved_at ?? new Date().toISOString() } : {}),
    ...(next.stage === "new" ? { approved_at: null } : {}),
  };
}

export function legRows(r: PulledRequest, requestId: string): TablesInsert<"ship_request_legs">[] {
  return r.legs.map((l) => ({
    request_id: requestId,
    public_leg_id: l.id,
    direction: l.direction,
    seq: l.seq,
    place_name: l.place_name,
    street1: l.street1,
    street2: l.street2,
    city: l.city,
    state: l.state,
    zip: l.zip,
    location_type: l.location_type,
    liftgate: l.liftgate,
    inside: l.inside,
    ready_date: l.ready_date,
    inbound_to: l.direction === "inbound" ? l.inbound_to : null,
    own_carrier: l.own_carrier,
    deliver_by: l.deliver_by,
    onsite_contact_name: l.onsite_contact_name,
    onsite_contact_mobile: l.onsite_contact_mobile,
    return_to_warehouse: l.return_to_warehouse,
    pieces: l.pieces,
    weight_lbs: l.weight_lbs,
    packaging: l.packaging,
    largest_l_in: l.largest_l_in,
    largest_w_in: l.largest_w_in,
    largest_h_in: l.largest_h_in,
    description: l.description,
    hazmat: l.hazmat,
    stage: stageAfterExhibitor("new", l.status ?? "requested").stage,
  }));
}

// ---------------------------------------------------------------------------
// Where a request stands, for the inbox
// ---------------------------------------------------------------------------

export type LegLite = { stage: string; own_carrier: boolean; direction: string };

/** A leg we price: not the exhibitor's own carrier, not cancelled. */
export const quotable = (l: LegLite) => !l.own_carrier && l.stage !== "cancelled";

export type RequestStanding = { key: "closed" | "quote" | "waiting" | "book" | "booked" | "change"; label: string };

export function standing(closed: string | null, legs: LegLite[], openChanges = 0): RequestStanding {
  if (closed) return { key: "closed", label: closed === "rejected" ? "Rejected" : "Cancelled" };
  if (openChanges) return { key: "change", label: "Change requested" };
  const priced = legs.filter(quotable);
  if (!priced.length) return { key: "booked", label: "Labels only" };
  if (priced.some((l) => l.stage === "new")) return { key: "quote", label: "Needs a quote" };
  if (priced.some((l) => l.stage === "approved")) return { key: "book", label: "Approved: book it" };
  if (priced.some((l) => l.stage === "quoted")) return { key: "waiting", label: "Quoted, waiting on exhibitor" };
  return { key: "booked", label: "Booked" };
}

/** Badge colours for where a request stands. */
export const STANDING_TONE: Record<RequestStanding["key"], string> = {
  quote: "bg-amber-100 text-amber-800",
  book: "bg-sky-100 text-sky-800",
  waiting: "bg-slate-100 text-slate-700",
  booked: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-100 text-slate-500",
  change: "bg-rose-100 text-rose-800",
};

/** A load number as Hyperion prints it. */
export const LOAD_NUMBER = /^[A-Za-z0-9-]{3,20}$/;

/** The shipment a booked leg becomes. Addresses are the exhibitor's end of the leg. */
export function shipmentForLeg(
  leg: {
    id: string;
    direction: string;
    inbound_to: string | null;
    street1: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    pieces: number | null;
    weight_lbs: number | null;
    packaging: string | null;
    liftgate: boolean;
    inside: boolean;
    hazmat: boolean;
    ready_date: string | null;
  },
  req: { show_id: string | null; booth: string | null; company: string | null; contact_name: string | null; mobile: string | null },
  loadNumber: string,
): TablesInsert<"shipments"> {
  const inbound = leg.direction === "inbound";
  const needs = [leg.liftgate ? "liftgate" : null, leg.inside ? "inside" : null, leg.hazmat ? "hazmat" : null].filter(Boolean);
  return {
    tms_reference_id: loadNumber,
    tms_sync_status: "pending",
    source: "ship_center",
    ship_leg_id: leg.id,
    show_id: req.show_id,
    show_auto_linked: false,
    status: "booked",
    mode: "LTL",
    direction: inbound ? "move_in" : "move_out",
    destination_type: inbound ? (leg.inbound_to === "direct" ? "direct_to_show" : "advance_warehouse") : null,
    booth_number: req.booth,
    pieces: leg.pieces,
    weight: leg.weight_lbs,
    package_type: leg.packaging,
    pickup_date: inbound ? leg.ready_date : null,
    special_requirements: needs.length ? needs.join(", ") : null,
    ...(inbound
      ? { origin_street: [leg.street1, leg.street2].filter(Boolean).join(", ") || null, origin_city: leg.city, origin_state: leg.state, origin_zip: leg.zip }
      : {
          consignee_company: req.company,
          consignee_contact: req.contact_name,
          consignee_phone: req.mobile,
          consignee_street1: leg.street1,
          consignee_street2: leg.street2,
          consignee_city: leg.city,
          consignee_state: leg.state,
          consignee_zip: leg.zip,
        }),
  };
}
