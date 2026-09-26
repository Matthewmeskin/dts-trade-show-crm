import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PartnerForm } from "../partner-form";
import { createPartner } from "../actions";
import { loadPeople } from "../parts";

export const dynamic = "force-dynamic";

export default async function NewPartnerPage() {
  const people = await loadPeople(await createClient());
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New partner"
        description="A company that controls freight for many exhibitors."
        breadcrumbs={[{ label: "Partners", href: "/partners" }]}
      />
      <PartnerForm action={createPartner} people={people} submitLabel="Add partner" />
    </div>
  );
}
