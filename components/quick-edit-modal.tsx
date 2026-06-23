"use client";

import { useState, type ReactNode, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

/**
 * Shared shell for the record "Edit" popups. A maroon trigger button opens a
 * centered WHITE panel containing a header (+ close) and the form passed as
 * children. Rendering on a white panel keeps the form's Save/Cancel footer
 * clearly visible — previously the buttons floated on the dim overlay and were
 * hard to read. Saving redirects back to the record, which remounts this
 * component and closes the modal.
 */
const DEFAULT_TRIGGER =
  "inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark";

export function QuickEditModal({
  title,
  triggerIcon,
  triggerLabel = "Edit",
  triggerClassName = DEFAULT_TRIGGER,
  maxWidth = "max-w-2xl",
  children,
}: {
  title: string;
  triggerIcon: IconName;
  triggerLabel?: string;
  triggerClassName?: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The forms' "Cancel" is a <Link> back to the record page — but we're already
  // there, so it would be a no-op inside the modal. Intercept clicks on any link
  // that points to the current page and just close the modal instead.
  const onContentClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor) {
      const url = new URL(anchor.href, window.location.origin);
      if (url.pathname === pathname) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        <Icon name={triggerIcon} className="h-4 w-4" /> {triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full ${maxWidth} rounded-2xl bg-white p-4 shadow-xl sm:p-5`}
            onClick={onContentClick}
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
