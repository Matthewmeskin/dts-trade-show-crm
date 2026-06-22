"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/**
 * Shared shell for the record "Edit" popups. A maroon trigger button opens a
 * centered WHITE panel containing a header (+ close) and the form passed as
 * children. Rendering on a white panel keeps the form's Save/Cancel footer
 * clearly visible — previously the buttons floated on the dim overlay and were
 * hard to read. Saving redirects back to the record, which remounts this
 * component and closes the modal.
 */
export function QuickEditModal({
  title,
  triggerIcon,
  triggerLabel = "Edit",
  maxWidth = "max-w-2xl",
  children,
}: {
  title: string;
  triggerIcon: IconName;
  triggerLabel?: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
      >
        <Icon name={triggerIcon} className="h-4 w-4" /> {triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full ${maxWidth} rounded-2xl bg-white p-4 shadow-xl sm:p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-heading text-lg font-semibold text-slate-900">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
