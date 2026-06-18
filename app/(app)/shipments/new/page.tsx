import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ShipmentForm } from "../shipment-form";
import { createShipment } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; exhibitor?: string }>;
}) {
  const { show, exhibitor } = await searchParams;
  const supabase = await createClient();

  const [{ data: shows }, { data: exhibitors }, { data: carriers }] =
    await Promise.all([
      supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
      supabase.from("exhibitors").select("id, company_name").order("company_name"),
      supabase.from("carriers").select("id, carrier_name").order("carrier_name"),
    ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Log shipment" description="Record a shipment for a show." breadcrumbs={[{ label: "Shipments", href: "/shipments" }]} />
      <ShipmentForm
        action={createShipment}
        shows={(shows ?? []).map((s) => ({
          id: s.id,
          label: `${s.show_name}${s.edition_year ? ` ${s.edition_year}` : ""}`,
        }))}
        exhibitors={(exhibitors ?? []).map((e) => ({ id: e.id, label: e.company_name }))}
        carriers={(carriers ?? []).map((c) => ({ id: c.id, label: c.carrier_name }))}
        defaults={{ show_id: show, exhibitor_id: exhibitor }}
        submitLabel="Log shipment"
      />
    </div>
  );
}
