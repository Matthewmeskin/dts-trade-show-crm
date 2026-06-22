"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { VenueForm } from "../venue-form";
import { updateVenue } from "../actions";

/** Edit a venue in a popup instead of navigating to the edit page. */
export function QuickEditVenue({ venue }: { venue: Tables<"venues"> }) {
  return (
    <QuickEditModal title="Edit venue" triggerIcon="venues">
      <VenueForm action={updateVenue} venue={venue} submitLabel="Save changes" />
    </QuickEditModal>
  );
}
