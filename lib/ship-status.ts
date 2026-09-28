/**
 * GSC Shipping Center status, both ways. Pure (tested).
 *
 * In: what the exhibitor did on their status page arrives with the pull as a
 *     newer version of the request; stageAfterExhibitor() says what that does
 *     to each leg's stage in the CRM.
 * Out: publicStatus() maps a leg's stage and its booked shipment to the words
 *     the exhibitor's page shows, by an explicit table (spec section 9: never
 *     a shared type), and statusRow() is what is sent. Never a price.
 */

export type Stage = "new" | "quoted" | "approved" | "booked" | "cancelled";
export type PublicStatus = "requested" | "quoted" | "approved" | "booked" | "in_transit" | "delivered" | "issue" | "cancelled";

/** The exhibitor's action, as the public project's leg status shows it, applied to the CRM's stage. */
export function stageAfterExhibitor(crm: string, exhibitor: string): { stage: string; approved: boolean } {
  if (crm === "booked") return { stage: crm, approved: false };
  if (exhibitor === "cancelled") return { stage: "cancelled", approved: false };
  if (exhibitor === "approved" && crm === "quoted") return { stage: "approved", approved: true };
  // A new piece count or weight on a priced leg: it needs a new price.
  if (exhibitor === "requested" && (crm === "quoted" || crm === "approved")) return { stage: "new", approved: false };
  return { stage: crm, approved: false };
}

const FROM_SHIPMENT: Record<string, PublicStatus> = {
  quoted: "booked",
  booked: "booked",
  in_transit: "in_transit",
  delivered: "delivered",
  issue: "issue",
};

export function publicStatus(stage: string, shipmentStatus: string | null): PublicStatus {
  switch (stage) {
    case "cancelled":
      return "cancelled";
    case "quoted":
      return "quoted";
    case "approved":
      return "approved";
    case "booked":
      return (shipmentStatus && FROM_SHIPMENT[shipmentStatus]) || "booked";
    default:
      return "requested";
  }
}

export type StatusRow = {
  leg_id: string;
  version: number;
  status: PublicStatus;
  carrier_name: string | null;
  pro_number: string | null;
  pickup_date: string | null;
  est_delivery: string | null;
  delivered_on: string | null;
};

export function statusRow(
  leg: { public_leg_id: string; stage: string },
  version: number,
  shipment: {
    status: string | null;
    pro_number: string | null;
    pickup_date: string | null;
    estimated_delivery_date: string | null;
    actual_delivery_date: string | null;
    carrier_name: string | null;
  } | null,
): StatusRow {
  const status = publicStatus(leg.stage, shipment?.status ?? null);
  const tracked = status === "booked" || status === "in_transit" || status === "delivered" || status === "issue";
  return {
    leg_id: leg.public_leg_id,
    version,
    status,
    carrier_name: tracked ? shipment?.carrier_name ?? null : null,
    pro_number: tracked ? shipment?.pro_number ?? null : null,
    pickup_date: tracked ? shipment?.pickup_date ?? null : null,
    est_delivery: tracked && !shipment?.actual_delivery_date ? shipment?.estimated_delivery_date ?? null : null,
    delivered_on: tracked ? shipment?.actual_delivery_date ?? null : null,
  };
}

const COMPARED = ["leg_id", "status", "carrier_name", "pro_number", "pickup_date", "est_delivery", "delivered_on"] as const;

/** Whether this row says something the public project has not accepted yet. The version alone is not news. */
export function changed(row: StatusRow, pushed: unknown): boolean {
  if (!pushed || typeof pushed !== "object") return true;
  const before = pushed as Record<string, unknown>;
  return COMPARED.some((k) => (row[k] ?? null) !== (before[k] ?? null));
}
