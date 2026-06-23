"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { ExhibitorForm } from "../exhibitor-form";
import { updateExhibitor } from "../actions";

/** Edit an exhibitor in a popup instead of navigating to the edit page. */
export function QuickEditExhibitor({
  exhibitor,
  redirectTo,
  triggerClassName,
}: {
  exhibitor: Tables<"exhibitors">;
  redirectTo?: string;
  triggerClassName?: string;
}) {
  return (
    <QuickEditModal title="Edit exhibitor" triggerIcon="exhibitors" triggerClassName={triggerClassName}>
      <ExhibitorForm
        action={updateExhibitor}
        exhibitor={exhibitor}
        submitLabel="Save changes"
        redirectTo={redirectTo}
      />
    </QuickEditModal>
  );
}
