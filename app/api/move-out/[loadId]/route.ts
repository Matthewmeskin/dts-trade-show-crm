/**
 * Path: app/api/move-out/[loadId]/route.ts
 * GET  /api/move-out/<shipmentId>  ->  the DTS outbound move-out PDF, auto-filled
 *                                      from the shipment row.
 * POST /api/move-out/<shipmentId>  ->  the same PDF rendered from an edited
 *                                      MoveOutShipment payload (the edit form).
 */

export const runtime = "nodejs"; // react-pdf needs Node, not the edge runtime

import { createClient } from "@/lib/supabase/server";
import { renderMoveOutForm } from "@/lib/move-out/MoveOutForm";
import { coerceMoveOutShipment } from "@/lib/move-out/types";
import {
  MOVE_OUT_SELECT,
  mapShipmentToMoveOut,
  type MoveOutJoined,
} from "@/lib/move-out/map-shipment";

function pdfResponse(pdf: Buffer, loadId: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="moveout-${loadId}.pdf"`,
    },
  });
}

async function requireUser() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  return claimsData?.claims?.sub ? supabase : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const supabase = await requireUser();
  if (!supabase) return new Response("Unauthorized", { status: 401 });

  const { data: shipment, error } = await supabase
    .from("shipments")
    .select(MOVE_OUT_SELECT)
    .eq("id", loadId)
    .single();

  if (error || !shipment) {
    return new Response("Shipment not found", { status: 404 });
  }

  const moveOut = mapShipmentToMoveOut(
    shipment as unknown as Record<string, unknown> & MoveOutJoined,
  );

  // `?format=json` returns the mapped defaults so the edit form can prefill
  // without a second data path; the default returns the rendered PDF.
  if (new URL(req.url).searchParams.get("format") === "json") {
    return Response.json(moveOut);
  }

  const pdf = await renderMoveOutForm(moveOut);
  return pdfResponse(pdf, loadId);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;
  const supabase = await requireUser();
  if (!supabase) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const pdf = await renderMoveOutForm(coerceMoveOutShipment(body));
  return pdfResponse(pdf, loadId);
}
