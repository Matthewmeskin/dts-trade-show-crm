"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Shows a floating detail card while hovering `label`, so list rows can be
 * previewed without opening the record. Rendered through a portal + fixed
 * positioning so it isn't clipped by a scrolling table.
 */
export function HoverPreview({
  label,
  children,
  className = "inline-block",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    // Hover preview is a pointer/mouse affordance — on touch devices a tap
    // fires mouseenter without a matching mouseleave, so the card would stick
    // (and overlap things like the side panel). Skip it when there's no hover.
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Clamp into the viewport so the card stays visible near edges.
    const top = Math.min(r.bottom + 6, window.innerHeight - 240);
    const left = Math.min(r.left, window.innerWidth - 360);
    setPos({ top: Math.max(8, top), left: Math.max(8, left) });
  };

  return (
    <span
      ref={ref}
      onMouseEnter={open}
      onMouseLeave={() => setPos(null)}
      className={className}
    >
      {label}
      {pos
        ? createPortal(
            <div
              style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 90, width: 340 }}
              className="pointer-events-none rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
