import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ShowForm } from "../../show-form";
import { updateShow } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: show }, { data: venues }, { data: contacts }] =
    await Promise.all([
      supabase.from("shows").select("*").eq("id", id).single(),
      supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
      supabase
        .from("contacts")
        .select("id, first_name, last_name, company")
        .order("last_name"),
    ]);

  if (!show) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit show" breadcrumbs={[{ label: "Shows", href: "/shows" }, { label: show.show_name, href: "/shows/" + id }]} />
      <ShowForm
        action={updateShow}
        show={show}
        venues={venues ?? []}
        contacts={contacts ?? []}
        submitLabel="Save changes"
      />
    </div>
  );
}
