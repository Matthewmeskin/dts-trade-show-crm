import { PageHeader } from "@/components/ui";
import { CarrierForm } from "../carrier-form";
import { createCarrier } from "../actions";

export const dynamic = "force-dynamic";

export default function NewCarrierPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New carrier" description="Add a carrier to the directory." breadcrumbs={[{ label: "Carriers", href: "/carriers" }]} />
      <CarrierForm action={createCarrier} submitLabel="Create carrier" />
    </div>
  );
}
