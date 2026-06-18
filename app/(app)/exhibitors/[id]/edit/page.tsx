import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ExhibitorForm } from "../../exhibitor-form";
import { updateExhibitor } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditExhibitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: exhibitor } = await supabase
    .from("exhibitors")
    .select("*")
    .eq("id", id)
    .single();
  if (!exhibitor) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit exhibitor" breadcrumbs={[{ label: "Exhibitors", href: "/exhibitors" }, { label: exhibitor.company_name, href: "/exhibitors/" + id }]} />
      <ExhibitorForm action={updateExhibitor} exhibitor={exhibitor} submitLabel="Save changes" />
    </div>
  );
}
