"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { LocalDateTime } from "@/components/local-time";
import { FORCED_REASONS, FORCED_REASON_META, type ForcedReason } from "@/lib/forced";
import { setShipmentForced, clearShipmentForced } from "../actions";

type Props = {
  id: string;
  forced: boolean;
  reason: ForcedReason | null;
  reasonOther: string | null;
  forcedAt: string | null;
  forcedByName: string | null;
};

export function ForcedControl({ id, forced, reason, reasonOther, forcedAt, forcedByName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ForcedReason | "">("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmForced() {
    setError(null);
    if (!selected) return setError("Choose a reason.");
    if (selected === "other" && !other.trim()) return setError("Tell us what happened.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("forced_reason", selected);
      fd.set("forced_reason_other", other);
      const res = await setShipmentForced({ error: null }, fd);
      if (res.error) return setError(res.error);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeForced() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", id);
      await clearShipmentForced({ error: null }, fd);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (forced) {
    const label = reason ? FORCED_REASON_META[reason].label : "Forced";
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                <Icon name="alert" className="h-3.5 w-3.5" /> Forced
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-red-900">{label}</p>
            {reason === "other" && reasonOther ? (
              <p className="mt-0.5 text-sm text-red-800">“{reasonOther}”</p>
            ) : null}
            <p className="mt-1 text-xs text-red-700/80">
              {forcedByName ? `Flagged by ${forcedByName}` : "Flagged"}
              {forcedAt ? (
                <>
                  {" · "}
                  <LocalDateTime iso={forcedAt} withTime />
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={removeForced}
            disabled={busy}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {busy ? "Removing…" : "Remove forced status"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected("");
          setOther("");
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
      >
        <Icon name="alert" className="h-4 w-4" /> Mark freight as forced
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Why was the freight forced?</h2>
            <p className="mt-1 text-sm text-slate-500">
              This flags the load as force-shipped by the general contractor and restarts the
              successful move-out counter.
            </p>

            <div className="mt-4 space-y-2">
              {FORCED_REASONS.map((r) => {
                const meta = FORCED_REASON_META[r];
                const active = selected === r;
                return (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      active ? "border-dts-maroon bg-dts-maroon/5" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="forced_reason"
                      value={r}
                      checked={active}
                      onChange={() => setSelected(r)}
                      className="mt-0.5 h-4 w-4 accent-dts-maroon"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{meta.label}</span>
                      {meta.hint ? (
                        <span className="block text-xs text-slate-500">{meta.hint}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            {selected === "other" ? (
              <textarea
                autoFocus
                value={other}
                onChange={(e) => setOther(e.target.value)}
                rows={3}
                placeholder="What happened?"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
              />
            ) : null}

            {error ? <p className="mt-3 text-sm text-dts-maroon">{error}</p> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmForced}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Mark as forced"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
