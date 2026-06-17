"use client";

import { Icon } from "@/components/icons";

/**
 * Reusable delete button: a form bound to a server action, gated by a
 * window.confirm. Pass the record id and a human message.
 */
export function ConfirmDelete({
  action,
  id,
  message,
  label = "Delete",
}: {
  action: (fd: FormData) => void | Promise<void>;
  id: string;
  message: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-dts-maroon hover:text-dts-maroon"
      >
        <Icon name="alert" className="h-4 w-4" /> {label}
      </button>
    </form>
  );
}
