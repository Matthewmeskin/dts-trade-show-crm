import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { VenueForm } from "../../venue-form";
import { updateVenue } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("*").eq("id", id).single();
  if (!venue) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit venue" breadcrumbs={[{ label: "Venues", href: "/venues" }, { label: venue.venue_name, href: "/venues/" + id }]} />
      <VenueForm action={updateVenue} venue={venue} submitLabel="Save changes" />
    </div>
  );
}
