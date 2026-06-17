import { PageHeader } from "@/components/ui";
import { VenueForm } from "../venue-form";
import { createVenue } from "../actions";

export const dynamic = "force-dynamic";

export default function NewVenuePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New venue" description="Add a venue to the CRM." />
      <VenueForm action={createVenue} submitLabel="Create venue" />
    </div>
  );
}
