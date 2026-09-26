import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { PartnerForm } from "../../partner-form";
import { updatePartner } from "../../actions";
import { loadPeople } from "../../parts";

export const dynamic = "force-dynamic";

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: partner }, people] = await Promise.all([
    supabase.from("partners").select("*").eq("id", id).maybeSingle(),
    loadPeople(supabase),
  ]);
  if (!partner) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit partner"
        breadcrumbs={[
          { label: "Partners", href: "/partners" },
          { label: partner.name, href: `/partners/${id}` },
        ]}
      />
      <PartnerForm action={updatePartner} partner={partner} people={people} submitLabel="Save changes" />
    </div>
  );
}
