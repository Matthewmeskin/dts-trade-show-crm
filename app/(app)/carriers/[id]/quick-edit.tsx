"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { CarrierForm } from "../carrier-form";
import { updateCarrier } from "../actions";

/** Edit a carrier in a popup instead of navigating to the edit page. */
export function QuickEditCarrier({
  carrier,
  redirectTo,
  triggerClassName,
}: {
  carrier: Tables<"carriers">;
  redirectTo?: string;
  triggerClassName?: string;
}) {
  return (
    <QuickEditModal title="Edit carrier" triggerIcon="carriers" triggerClassName={triggerClassName}>
      <CarrierForm
        action={updateCarrier}
        carrier={carrier}
        submitLabel="Save changes"
        redirectTo={redirectTo}
      />
    </QuickEditModal>
  );
}
