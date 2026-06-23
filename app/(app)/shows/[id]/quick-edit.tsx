"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { ShowForm } from "../show-form";
import { updateShow } from "../actions";

type VenueOpt = Pick<Tables<"venues">, "id" | "venue_name" | "city" | "state">;
type ContactOpt = Pick<
  Tables<"contacts">,
  "id" | "first_name" | "last_name" | "company"
>;

/** Edit a show in a popup instead of navigating to the edit page. */
export function QuickEditShow({
  show,
  venues,
  contacts,
  redirectTo,
  triggerClassName,
}: {
  show: Tables<"shows">;
  venues: VenueOpt[];
  contacts: ContactOpt[];
  redirectTo?: string;
  triggerClassName?: string;
}) {
  return (
    <QuickEditModal title="Edit show" triggerIcon="shows" maxWidth="max-w-3xl" triggerClassName={triggerClassName}>
      <ShowForm
        action={updateShow}
        show={show}
        venues={venues}
        contacts={contacts}
        submitLabel="Save changes"
        redirectTo={redirectTo}
      />
    </QuickEditModal>
  );
}
