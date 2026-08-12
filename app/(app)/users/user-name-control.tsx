"use client";

import { setUserName } from "./actions";

/**
 * Inline-editable display name for a user row: reads as plain text until you
 * hover/focus, saved on blur (same pattern as the contact editor).
 */
export function UserNameControl({ id, name }: { id: string; name: string | null }) {
  return (
    <form action={setUserName}>
      <input type="hidden" name="id" value={id} />
      <input
        name="full_name"
        defaultValue={name ?? ""}
        placeholder="Add name"
        aria-label="Full name"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-dts-maroon focus:bg-white focus:ring-1 focus:ring-dts-maroon"
      />
    </form>
  );
}
