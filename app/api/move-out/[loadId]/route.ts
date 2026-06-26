/**
 * Path: app/api/move-out/[loadId]/route.ts
 * GET /api/move-out/<shipmentId>  ->  the DTS outbound move-out PDF for one shipment.
 *
 * The schema-specific part is mapShipmentToMoveOut, which maps a row from this
 * project's `shipments` table (+ joined exhibitor / carrier / show) onto the
 * MoveOutShipment shape the renderer expects.
 */

export const runtime = "nodejs"; // react-pdf needs Node, not the edge runtime

import { createClient } from "@/lib/supabase/server";
import {
  renderMoveOutForm,
  DTS_BILL_TO,
  type MoveOutShipment,
  type Party,
} from "@/lib/move-out/MoveOutForm";

type Joined = {
  exhibitor: {
    company_name: string | null;
    primary_contact_name: string | null;
    primary_contact_phone: string | null;
    primary_contact_email: string | null;
  } | null;
  carrier: {
    carrier_name: string | null;
    bill_to_company: string | null;
    bill_to_address1: string | null;
    bill_to_address2: string | null;
    bill_to_city: string | null;
    bill_to_state: string | null;
    bill_to_zip: string | null;
    bill_to_phone: string | null;
  } | null;
  show: { show_name: string | null } | null;
};

/** A carrier's own bill-to, when they have one set; otherwise null (use DTS). */
function carrierBillTo(carrier: Joined["carrier"]): Party | null {
  if (!carrier?.bill_to_company || !carrier.bill_to_address1) return null;
  return {
    company: carrier.bill_to_company,
    address1: carrier.bill_to_address1,
    address2: carrier.bill_to_address2 ?? undefined,
    city: carrier.bill_to_city ?? "",
    state: carrier.bill_to_state ?? "",
    zip: carrier.bill_to_zip ?? "",
    phone: carrier.bill_to_phone ?? undefined,
  };
}

/* ---------------------------- Accessorial mapping ---------------------------- */
/** Split free-text requirement notes into individual phrases. */
function splitNotes(...texts: (string | null | undefined)[]): string[] {
  return texts
    .filter(Boolean)
    .flatMap((t) => (t as string).split(/[\n;,]+/))
    .map((x) => x.trim())
    .filter(Boolean);
}

function mapAccessorials(raw: string[]): {
  accessorials: MoveOutShipment["accessorials"];
  extraInstructions: string[];
} {
  const has = (...keys: string[]) =>
    raw.some((a) => keys.some((k) => a.toLowerCase().includes(k)));

  const accessorials = {
    liftgate: has("liftgate", "lift gate", "lgate"),
    insideDelivery: has("inside delivery", "inside"),
    residential: has("residential", "resi"),
    doNotStack: has("do not stack", "non-stack", "nonstack"),
    padWrap: has("pad wrap", "blanket wrap"),
    loadingDock: has("dock"),
    airRide: has("air ride", "air-ride"),
  };

  const checkboxKeys = [
    "liftgate", "lift gate", "lgate", "inside", "residential", "resi",
    "do not stack", "nonstack", "non-stack", "pad wrap", "blanket wrap",
    "dock", "air ride", "air-ride",
  ];
  const extraInstructions = raw.filter(
    (a) => !checkboxKeys.some((k) => a.toLowerCase().includes(k)),
  );

  return { accessorials, extraInstructions };
}

/* ---------------------------- Shipment -> form ------------------------------ */
function mapShipmentToMoveOut(
  shipment: Record<string, unknown> & Joined,
): MoveOutShipment {
  const exhibitor = shipment.exhibitor;
  const carrier = shipment.carrier;
  const show = shipment.show;

  const { accessorials, extraInstructions } = mapAccessorials(
    splitNotes(
      shipment.special_requirements as string | null,
      shipment.notes as string | null,
    ),
  );

  const s = (k: string) => (shipment[k] as string | null) ?? undefined;

  // SHIP TO = the consignee on the load (the move-out return party), pulled from
  // the Hyperion delivery stop by the TMS sync. Falls back to the exhibitor /
  // flat destination_address for older rows that predate the structured sync.
  const shipTo: Party = {
    company: s("consignee_company") ?? exhibitor?.company_name ?? "",
    address1: s("consignee_street1") ?? s("destination_address") ?? "",
    address2: s("consignee_street2"),
    city: s("consignee_city") ?? "",
    state: s("consignee_state") ?? "",
    zip: s("consignee_zip") ?? "",
    phone: s("consignee_phone") ?? exhibitor?.primary_contact_phone ?? undefined,
    attn: s("consignee_contact") ?? exhibitor?.primary_contact_name ?? undefined,
  };

  return {
    showName: show?.show_name ?? "",
    booth: s("booth_number"),
    exhibitorCompany: exhibitor?.company_name ?? "",
    contactName: exhibitor?.primary_contact_name ?? undefined,
    contactPhone: exhibitor?.primary_contact_phone ?? undefined,
    contactEmail: exhibitor?.primary_contact_email ?? undefined,
    shipTo,
    // Per-carrier bill-to when set, otherwise the default DTS bill-to.
    billTo: carrierBillTo(carrier) ?? DTS_BILL_TO,
    carrier: { name: carrier?.carrier_name ?? "" },
    levelOfService: "ground", // always ground for move-outs
    accessorials,
    extraInstructions,
    numberOfLabels: (shipment.pieces as number | null) ?? undefined,
  };
}

/* --------------------------------- Handler ----------------------------------- */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const supabase = await createClient();

  // /api is public to the proxy, so guard the route itself.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: shipment, error } = await supabase
    .from("shipments")
    .select(
      "*, exhibitor:exhibitors(company_name, primary_contact_name, primary_contact_phone, primary_contact_email), carrier:carriers(carrier_name, bill_to_company, bill_to_address1, bill_to_address2, bill_to_city, bill_to_state, bill_to_zip, bill_to_phone), show:shows(show_name)",
    )
    .eq("id", loadId)
    .single();

  if (error || !shipment) {
    return new Response("Shipment not found", { status: 404 });
  }

  const pdf = await renderMoveOutForm(
    mapShipmentToMoveOut(shipment as Record<string, unknown> & Joined),
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="moveout-${loadId}.pdf"`,
    },
  });
}
