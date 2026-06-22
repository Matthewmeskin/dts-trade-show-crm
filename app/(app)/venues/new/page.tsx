import { PageHeader } from "@/components/ui";
import { ImportableVenueForm } from "../importable-venue-form";

export const dynamic = "force-dynamic";

export default function NewVenuePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New venue" description="Add a venue to the CRM." breadcrumbs={[{ label: "Venues", href: "/venues" }]} />
      <ImportableVenueForm />
    </div>
  );
}
