import { PageHeader } from "@/components/ui";
import { MhaCheckForm } from "./mha-check-form";

export const dynamic = "force-dynamic";

export default function MhaCheckPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="MHA Check"
        description="Upload a photo or PDF of a Material Handling Agreement (outbound BOL). We read it and check the two things that must be right — the carrier isn't DTS, and the freight is billed to DTS — plus your booked load when we can find it."
      />
      <MhaCheckForm />
    </div>
  );
}
