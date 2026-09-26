"use client";

import { useActionState, useState } from "react";
import { SubmitButton, inputClass } from "@/components/form";
import { savePlaybookSection, type PartnerState } from "../actions";

export function EditSection({ sectionKey, title, body }: { sectionKey: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: PartnerState, fd: FormData) => {
    const r = await savePlaybookSection(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, { error: null } as PartnerState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-dts-maroon hover:underline">
        Edit
      </button>
    );
  }
  return (
    <form action={action} className="w-full space-y-2">
      <input type="hidden" name="key" value={sectionKey} />
      <input name="title" defaultValue={title} className={inputClass} aria-label="Title" />
      <textarea name="body" defaultValue={body} rows={12} className={`${inputClass} font-mono text-xs`} aria-label="Body" />
      <p className="text-xs text-slate-400">
        Blank line between paragraphs. Lists start with - or 1. — **bold** for emphasis — tables with | pipes |.
      </p>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save section</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Cancel
        </button>
        {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
      </div>
    </form>
  );
}
