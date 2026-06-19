"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

const MESSAGES: Record<string, string> = {
  created: "Created successfully",
  updated: "Changes saved",
  saved: "Saved",
  deleted: "Deleted",
  uploaded: "Document uploaded",
  scan: "Scan started — candidates appear in about a minute.",
  imported: "Loads added as shipments.",
  scan_unconfigured: "Scan webhook isn't configured yet (set N8N_SCAN_WEBHOOK_URL).",
};

/**
 * Reads a `?flash=<kind>` param set by server actions on redirect, shows a
 * transient toast, then strips the param from the URL. Lives in the app shell
 * so it works after every create / update / delete redirect.
 */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flash = params.get("flash");
  const [msg, setMsg] = useState<string | null>(null);

  // Capture the flash and clean it out of the URL.
  useEffect(() => {
    if (!flash) return;
    setMsg(MESSAGES[flash] ?? "Done");
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete("flash");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  // Auto-dismiss, keyed on the message so the timer isn't cleared by the
  // param-stripping re-render above.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex justify-end">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-dts-maroon/10 text-dts-maroon">
          <Icon name="check" className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-slate-800">{msg}</span>
        <button
          type="button"
          onClick={() => setMsg(null)}
          className="ml-1 text-slate-300 transition hover:text-slate-500"
          aria-label="Dismiss"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
