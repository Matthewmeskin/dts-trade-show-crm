import { PageHeader } from "@/components/ui";
import { ExhibitorForm } from "../exhibitor-form";
import { createExhibitor } from "../actions";

export const dynamic = "force-dynamic";

export default function NewExhibitorPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New exhibitor" description="Add an exhibitor to the directory." />
      <ExhibitorForm action={createExhibitor} submitLabel="Create exhibitor" />
    </div>
  );
}
