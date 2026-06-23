"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { Icon } from "@/components/icons";
import { signOut } from "@/app/login/actions";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  userName,
  userEmail,
  role,
  mobileOpen = false,
  desktopCollapsed = false,
  onNavigate,
}: {
  userName: string;
  userEmail: string;
  role: string;
  mobileOpen?: boolean;
  desktopCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [logoOk, setLogoOk] = useState(true);
  const initials =
    userName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-dts-blue text-white transition-transform duration-200 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${desktopCollapsed ? "md:hidden" : "md:static md:translate-x-0"}`}
    >
      <div className="px-4 py-4">
        <Link href="/" onClick={onNavigate} className="block" aria-label="DTS Trade Show CRM — home">
          {logoOk ? (
            // Real raster logo on a white card so the brand colors read against
            // the blue sidebar. Drop the file at public/dts-logo.png.
            <span className="block rounded-lg bg-white px-3 py-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dts-logo.png"
                alt="DTS — Diversified Transportation Services"
                className="h-9 w-auto"
                onError={() => setLogoOk(false)}
              />
            </span>
          ) : (
            <span className="font-heading text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Trade Show CRM
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin").map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-dts-maroon text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon
                name={item.icon}
                className={`h-[18px] w-[18px] ${active ? "text-white" : "text-white/60"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/15 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">
              {userName}
            </div>
            <div className="truncate text-xs text-white/60">{userEmail}</div>
          </div>
          {role === "admin" ? (
            <span className="rounded bg-dts-maroon px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Admin
            </span>
          ) : null}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="signout" className="h-[18px] w-[18px] text-white/60" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
