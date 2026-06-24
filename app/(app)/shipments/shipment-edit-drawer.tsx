"use client";

import { useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import type { Tables } from "@/lib/database.types";
import { ShipmentForm } from "./shipment-form";
import { updateShipment } from "./actions";
import { ShipmentDocuments } from "./shipment-documents";

type Opt = { id: string; label: string };

/**
 * Side drawer holding the full shipment edit form plus its documents, so a
 * shipment can be edited without leaving the show's Shipments tab. Saving
 * redirects back to this page (the parent closes the drawer on the resulting
 * flash); Cancel — a link to this same page — is intercepted to just close.
 */
export function ShipmentEditDrawer({
  shipment,
  shows,
  exhibitors,
  venues,
  showId,
  onClose,
}: {
  shipment: Tables<"shipments">;
  shows: Opt[];
  exhibitors: Opt[];
  venues: Opt[];
  showId: string;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onContentClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor) {
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin === window.location.origin && url.pathname === pathname) {
        e.preventDefault();
        onClose();
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-slate-900/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-dts-bg shadow-xl"
        onClick={onContentClick}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <h2 className="font-heading text-base font-semibold text-slate-900">Edit shipment</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <ShipmentForm
            action={updateShipment}
            shipment={shipment}
            shows={shows}
            exhibitors={exhibitors}
            venues={venues}
            submitLabel="Save changes"
            redirectTo={`/shows/${showId}?tab=shipments&flash=updated`}
          />
          <div className="mt-6">
            <ShipmentDocuments shipmentId={shipment.id} showId={shipment.show_id} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
