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
      <PageHeader title="Edit exhibitor" description={exhibitor.company_name} />
      <ExhibitorForm action={updateExhibitor} exhibitor={exhibitor} submitLabel="Save changes" />
    </div>
  );
}
