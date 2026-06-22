"use client";

import type { Tables } from "@/lib/database.types";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { TaskForm, type RelatedOptions } from "../task-form";
import { updateTask } from "../actions";

type Opt = { id: string; label: string };

/** Edit a task in a popup instead of navigating to the edit page. */
export function QuickEditTask({
  task,
  profiles,
  related,
}: {
  task: Tables<"tasks">;
  profiles: Opt[];
  related: RelatedOptions;
}) {
  return (
    <QuickEditModal title="Edit task" triggerIcon="tasks">
      <TaskForm
        action={updateTask}
        task={task}
        profiles={profiles}
        related={related}
        submitLabel="Save changes"
      />
    </QuickEditModal>
  );
}
