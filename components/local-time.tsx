"use client";

/**
 * Renders an absolute timestamp in the viewer's local timezone. Server-side
 * rendering happens in UTC, so without this a midnight-UTC sync (e.g. an
 * overnight cron) shows the next calendar day. suppressHydrationWarning lets the
 * client value take over after hydration.
 */
export function LocalDateTime({
  iso,
  withTime = true,
}: {
  iso: string;
  withTime?: boolean;
}) {
  const d = new Date(iso);
  const text = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
      });
  return <span suppressHydrationWarning>{text}</span>;
}
