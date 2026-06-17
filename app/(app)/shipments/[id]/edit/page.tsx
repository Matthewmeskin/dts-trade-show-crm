import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ShipmentForm } from "../../shipment-form";
import { updateShipment } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: shipment }, { data: shows }, { data: exhibitors }, { data: carriers }] =
    await Promise.all([
      supabase.from("shipments").select("*").eq("id", id).single(),
      supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
      supabase.from("exhibitors").select("id, company_name").order("company_name"),
      supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
    ]);

  if (!shipment) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit shipment" description="Update shipment details." />
      <ShipmentForm
        action={updateShipment}
        shipment={shipment}
        shows={(shows ?? []).map((s) => ({
          id: s.id,
          label: `${s.show_name}${s.edition_year ? ` ${s.edition_year}` : ""}`,
        }))}
        exhibitors={(exhibitors ?? []).map((e) => ({ id: e.id, label: e.company_name }))}
        carriers={(carriers ?? []).map((c) => ({ id: c.id, label: c.carrier_name }))}
        submitLabel="Save changes"
      />
    </div>
  );
}
