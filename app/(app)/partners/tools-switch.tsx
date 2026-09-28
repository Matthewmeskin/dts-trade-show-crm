"use client";

import { useTransition } from "react";
import { setPartnerTools } from "./tools-actions";

/**
 * Admins only: bring back (or hide again) the partner growth tooling the GSC
 * Shipping Center replaced. Hidden by default; nothing is deleted either way.
 */
export function PartnerToolsSwitch({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <p className="mt-6 border-t border-slate-100 pt-3 text-xs text-slate-400">
      {on
        ? "Old partner tools are showing: worklist, calls, weekly client report, rebates and cobranded pages."
        : "Old partner tools (worklist, calls, weekly client report, rebates and cobranded pages) are hidden. Their data is kept."}{" "}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setPartnerTools(!on))}
        className="font-medium text-slate-500 underline hover:text-slate-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : on ? "Hide them" : "Show them"}
      </button>
    </p>
  );
}
