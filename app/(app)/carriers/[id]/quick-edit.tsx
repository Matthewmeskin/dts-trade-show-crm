"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import type { Tables } from "@/lib/database.types";
import { CarrierForm } from "../carrier-form";
import { updateCarrier } from "../actions";

/**
 * Edit a carrier in a popup instead of navigating to the edit page. Reuses the
 * full CarrierForm; saving redirects back here (which closes the modal).
 */
export function QuickEditCarrier({ carrier }: { carrier: Tables<"carriers"> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
      >
        <Icon name="carriers" className="h-4 w-4" /> Edit
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-white">
              <h2 className="font-heading text-lg font-semibold">Edit carrier</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg bg-white/10 p-1.5 transition hover:bg-white/20"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            <CarrierForm
              action={updateCarrier}
              carrier={carrier}
              submitLabel="Save changes"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
