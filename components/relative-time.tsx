"use client";

import { useEffect, useState } from "react";

/** "just now", "5m ago", "3h ago", "2d ago", else the absolute date. */
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Relative timestamp. Computed on the client after mount so the server render
 * stays pure (no `Date.now()` in render) and there's no hydration mismatch.
 * `title` carries the absolute time for hover.
 */
export function RelativeTime({ iso, title }: { iso: string; title?: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => setLabel(ago(iso));
    // Defer the first computation out of the effect body (avoids a synchronous
    // setState in render/effect) and refresh once a minute after that.
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [iso]);
  return (
    <time dateTime={iso} title={title} suppressHydrationWarning>
      {label}
    </time>
  );
}
