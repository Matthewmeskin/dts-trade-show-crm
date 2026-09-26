"use client";

import { useState } from "react";
import { inputClass } from "@/components/form";
import { Icon } from "@/components/icons";

/**
 * AI drafts the first touch; the admin edits it and sends it from their own
 * mailbox. Nothing is sent from here, and nothing is saved - log the touch
 * after it goes out.
 */
export function DraftTouch({
  partnerId,
  shows,
  email,
}: {
  partnerId: string;
  shows: { id: string; label: string }[];
  email: string | null;
}) {
  const [showId, setShowId] = useState(shows[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  if (!shows.length) {
    return (
      <p className="text-xs text-slate-500">
        Link one of their upcoming shows first. The first touch always names a specific show.
      </p>
    );
  }

  async function draft() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/partners/draft-touch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, show_id: showId }),
      });
      const r = await res.json().catch(() => null);
      if (!r?.ok) setError(r?.error ?? "The drafter failed. Try again.");
      else {
        setSubject(r.subject);
        setBody(r.body);
      }
    } catch {
      setError("The drafter didn't answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const mailto = email
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={showId} onChange={(e) => setShowId(e.target.value)} className={`${inputClass} w-auto py-1.5`} aria-label="Show to name">
          {shows.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={draft}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
        >
          <Icon name="sparkles" className="h-4 w-4" />
          {busy ? "Drafting…" : subject ? "Redraft" : "Draft first touch"}
        </button>
      </div>
      {error ? <p className="text-sm text-dts-maroon">{error}</p> : null}
      {subject || body ? (
        <>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputClass} py-1.5`} aria-label="Subject" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={inputClass} aria-label="Body" />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                setCopied(true);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {mailto ? (
              <a href={mailto} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
                Open in email
              </a>
            ) : null}
            <span className="text-xs text-slate-400">Read it, make it yours, send it, then log the touch.</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
