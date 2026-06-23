"use client";

import { setUserRole, deleteUser } from "./actions";

/**
 * Inline controls for a user row: a role dropdown that submits on change, and a
 * remove button. Disabled for your own account so you can't lock yourself out.
 */
export function UserRowControls({
  id,
  role,
  name,
  isSelf,
}: {
  id: string;
  role: string;
  name: string;
  isSelf: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <form action={setUserRole}>
        <input type="hidden" name="id" value={id} />
        <select
          name="role"
          defaultValue={role}
          disabled={isSelf}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={`Role for ${name}`}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="standard">Standard</option>
          <option value="admin">Admin</option>
        </select>
      </form>

      {isSelf ? (
        <span className="text-xs text-slate-300">You</span>
      ) : (
        <form
          action={deleteUser}
          onSubmit={(e) => {
            if (!confirm(`Remove ${name || "this user"}? They will lose access immediately.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-dts-maroon/5 hover:text-dts-maroon"
          >
            Remove
          </button>
        </form>
      )}
    </div>
  );
}
