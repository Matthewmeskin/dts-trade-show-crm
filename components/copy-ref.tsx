"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * A reference number you can read aloud or copy in one click.
 *
 * Exists because this number's whole job is to be quoted — on the phone, in an
 * email, into the MHA lookup — so it is set in a monospace face at a size that
 * survives being read off a screen, and copies without selecting it by hand.
 */
export function CopyRef({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (insecure context, or permission denied). The
          // number is still on screen to read, so say nothing rather than throw.
        }
      }}
      title={copied ? "Copied" : `Copy ${value}`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-sm font-semibold tracking-tight text-slate-900 transition hover:bg-slate-100"
    >
      {value}
      <Icon
        name={copied ? "check" : "documents"}
        className={`h-3 w-3 ${copied ? "text-emerald-600" : "text-slate-400"}`}
      />
    </button>
  );
}
