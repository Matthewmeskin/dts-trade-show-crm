import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ImportableShowForm } from "../importable-show-form";

export const dynamic = "force-dynamic";

export default async function NewShowPage() {
  const supabase = await createClient();
  const [{ data: venues }, { data: contacts }] = await Promise.all([
    supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, company")
      .order("last_name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New show" description="Add a trade show to the CRM." breadcrumbs={[{ label: "Shows", href: "/shows" }]} />
      <ImportableShowForm venues={venues ?? []} contacts={contacts ?? []} />
    </div>
  );
}
