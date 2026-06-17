import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "../../task-form";
import { updateTask } from "../../actions";
import { loadTaskOptions } from "../../options";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single();
  if (!task) notFound();

  const { profiles, related } = await loadTaskOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit task" description={task.title} />
      <TaskForm
        action={updateTask}
        task={task}
        profiles={profiles}
        related={related}
        submitLabel="Save changes"
      />
    </div>
  );
}
