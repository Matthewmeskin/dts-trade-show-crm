"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { setCheckInNumber } from "./actions";

/**
 * Inline check-in number editor for a shipment row. A green check shows when a
 * number is saved, a muted dash when not. Clicking opens a small input. The
 * field is for move-out shipments, so it's only editable for those — other rows
 * show a plain dash.
 */
export function CheckInCell({
  shipmentId,
  showId,
  value,
  editable,
}: {
  shipmentId: string;
  showId: string;
  value: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [busy, setBusy] = useState(false);

  if (!editable) return <span className="text-slate-300">—</span>;

  async function save() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", shipmentId);
      fd.set("show_id", showId);
      fd.set("check_in_number", val.trim());
      await setCheckInNumber(fd);
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setVal(value ?? "");
              setEditing(false);
            }
          }}
          placeholder="Check-in #"
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          aria-label="Save check-in number"
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
        >
          <Icon name="check" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setVal(value ?? "");
            setEditing(false);
          }}
          aria-label="Cancel"
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-100"
      title={value ? `Check-in #: ${value}` : "Add check-in number"}
    >
      {value ? (
        <>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon name="check" className="h-3 w-3" />
          </span>
          <span className="text-xs text-slate-600">{value}</span>
        </>
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </button>
  );
}
