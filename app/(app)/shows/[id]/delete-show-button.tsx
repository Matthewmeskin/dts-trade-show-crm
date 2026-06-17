"use client";

import { deleteShow } from "../actions";
import { Icon } from "@/components/icons";

export function DeleteShowButton({
  id,
  showName,
}: {
  id: string;
  showName: string;
}) {
  return (
    <form
      action={deleteShow}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${showName}"? This also removes its exhibitor links, shipments, documents, tasks, and debrief. This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-dts-maroon hover:text-dts-maroon"
      >
        <Icon name="alert" className="h-4 w-4" /> Delete
      </button>
    </form>
  );
}
