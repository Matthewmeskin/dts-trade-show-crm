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
  carrier: { carrier_name: string | null } | null;
  show: { show_name: string | null } | null;
};

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

  // SHIP TO = where the freight returns after the show. We don't store a
  // structured consignee, so use the exhibitor as the consignee and the
  // shipment's destination_address as the street line; the rest is hand-filled.
  const shipTo: Party = {
    company: exhibitor?.company_name ?? "",
    address1: (shipment.destination_address as string | null) ?? "",
    city: "",
    state: "",
    zip: "",
    phone: exhibitor?.primary_contact_phone ?? undefined,
    attn: exhibitor?.primary_contact_name ?? undefined,
  };

  return {
    showName: show?.show_name ?? "",
    exhibitorCompany: exhibitor?.company_name ?? "",
    contactName: exhibitor?.primary_contact_name ?? undefined,
    contactPhone: exhibitor?.primary_contact_phone ?? undefined,
    contactEmail: exhibitor?.primary_contact_email ?? undefined,
    shipTo,
    billTo: DTS_BILL_TO, // no per-carrier override stored yet
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
      "*, exhibitor:exhibitors(company_name, primary_contact_name, primary_contact_phone, primary_contact_email), carrier:carriers(carrier_name), show:shows(show_name)",
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
