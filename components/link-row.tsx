"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * A table row whose entire surface navigates to `href`. Clicks that land on a
 * nested interactive element (links, buttons, inputs) are left alone, so inner
 * links still work and keyboard/middle-click/⌘-click behave as expected.
 */
export function LinkRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("a,button,input,select,textarea,label,[role=button]"))
          return;
        if (e.metaKey || e.ctrlKey) {
          window.open(href, "_blank");
          return;
        }
        router.push(href);
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  );
}
