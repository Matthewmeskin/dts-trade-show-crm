import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CarrierForm } from "../../carrier-form";
import { updateCarrier } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCarrierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: carrier } = await supabase.from("carriers").select("*").eq("id", id).single();
  if (!carrier) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit carrier" breadcrumbs={[{ label: "Carriers", href: "/carriers" }, { label: carrier.carrier_name, href: "/carriers/" + id }]} />
      <CarrierForm action={updateCarrier} carrier={carrier} submitLabel="Save changes" />
    </div>
  );
}
