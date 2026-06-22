"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { ContactForm, type ContactOptions } from "../contact-form";
import { updateContact } from "../actions";

/** Edit a contact in a popup instead of navigating to the edit page. */
export function QuickEditContact({
  contact,
  options,
}: {
  contact: Tables<"contacts">;
  options: ContactOptions;
}) {
  return (
    <QuickEditModal title="Edit contact" triggerIcon="contacts">
      <ContactForm
        action={updateContact}
        contact={contact}
        options={options}
        submitLabel="Save changes"
      />
    </QuickEditModal>
  );
}
