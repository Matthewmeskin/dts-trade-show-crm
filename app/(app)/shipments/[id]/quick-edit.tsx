"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { ShipmentForm } from "../shipment-form";
import { updateShipment } from "../actions";

type Opt = { id: string; label: string };

/** Edit a shipment in a popup instead of navigating to the edit page. */
export function QuickEditShipment({
  shipment,
  shows,
  exhibitors,
}: {
  shipment: Tables<"shipments">;
  shows: Opt[];
  exhibitors: Opt[];
}) {
  return (
    <QuickEditModal title="Edit shipment" triggerIcon="shipments">
      <ShipmentForm
        action={updateShipment}
        shipment={shipment}
        shows={shows}
        exhibitors={exhibitors}
        submitLabel="Save changes"
      />
    </QuickEditModal>
  );
}
