"use client";

import { useState } from "react";

/**
 * Copy the report as a formatted email (paste into Outlook keeps the tables),
 * or open it in the mail app as plain text. Sending is always the rep's.
 */
export function ReportActions({
  html,
  text,
  subject,
  to,
}: {
  html: string;
  text: string;
  subject: string;
  to: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100";

  async function copyRich() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      setCopied("Copied — paste it into a new email.");
    } catch {
      await navigator.clipboard.writeText(text);
      setCopied("Copied as plain text.");
    }
  }

  const mailto = `mailto:${encodeURIComponent(to ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copyRich} className={btn}>
        Copy email
      </button>
      <button type="button" onClick={() => navigator.clipboard.writeText(subject).then(() => setCopied("Subject copied."))} className={btn}>
        Copy subject
      </button>
      <a href={mailto} className={btn}>
        Open in email (plain text)
      </a>
      {copied ? <span className="text-sm text-emerald-600">{copied}</span> : null}
    </div>
  );
}
