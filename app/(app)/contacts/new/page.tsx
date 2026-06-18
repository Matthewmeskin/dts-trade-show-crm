import { PageHeader } from "@/components/ui";
import { ContactForm } from "../contact-form";
import { createContact } from "../actions";
import { loadContactOptions } from "../options";

export const dynamic = "force-dynamic";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; exhibitor?: string; venue?: string; carrier?: string }>;
}) {
  const sp = await searchParams;
  const options = await loadContactOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New contact" description="Add a contact and attach it to a record." breadcrumbs={[{ label: "Contacts", href: "/contacts" }]} />
      <ContactForm
        action={createContact}
        options={options}
        defaults={{
          show_id: sp.show,
          exhibitor_id: sp.exhibitor,
          venue_id: sp.venue,
          carrier_id: sp.carrier,
        }}
        submitLabel="Create contact"
      />
    </div>
  );
}
