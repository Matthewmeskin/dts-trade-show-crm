import { PageHeader } from "@/components/ui";
import { TaskForm } from "../task-form";
import { createTask } from "../actions";
import { loadTaskOptions } from "../options";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{
    show?: string;
    exhibitor?: string;
    shipment?: string;
    carrier?: string;
    venue?: string;
  }>;
}) {
  const sp = await searchParams;
  const { profiles, related } = await loadTaskOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New task" description="Create and assign a task." />
      <TaskForm
        action={createTask}
        profiles={profiles}
        related={related}
        defaults={{
          related_show_id: sp.show,
          related_exhibitor_id: sp.exhibitor,
          related_shipment_id: sp.shipment,
          related_carrier_id: sp.carrier,
          related_venue_id: sp.venue,
        }}
        submitLabel="Create task"
      />
    </div>
  );
}
