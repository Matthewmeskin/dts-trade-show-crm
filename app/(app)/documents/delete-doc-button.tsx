"use client";

import { deleteDocument } from "./actions";

export function DeleteDocButton({
  id,
  path,
  showId,
  name,
  bucket,
}: {
  id: string;
  path: string | null;
  showId: string | null;
  name: string;
  bucket?: string;
}) {
  return (
    <form
      action={deleteDocument}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${name}"? The file is removed permanently.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path ?? ""} />
      <input type="hidden" name="show_id" value={showId ?? ""} />
      {bucket ? <input type="hidden" name="bucket" value={bucket} /> : null}
      <button type="submit" className="text-xs font-medium text-slate-400 hover:text-dts-maroon">
        Delete
      </button>
    </form>
  );
}
