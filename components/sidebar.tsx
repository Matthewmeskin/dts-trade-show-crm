"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, type NavItem } from "@/lib/nav";
import { Icon } from "@/components/icons";
import { signOut } from "@/app/login/actions";

function isActive(pathname: string, item: NavItem): boolean {
  const hrefs = [item.href, ...(item.match ?? [])];
  if (item.exclude?.some((x) => pathname === x || pathname.startsWith(`${x}/`))) return false;
  return hrefs.some((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );
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
      className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 transition-transform duration-200 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${desktopCollapsed ? "md:hidden" : "md:static md:translate-x-0"}`}
    >
      <div className="border-b border-slate-200 px-3 py-2.5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 whitespace-nowrap font-heading text-[15px] font-bold text-dts-maroon"
          aria-label="DTS Trade Show CRM — home"
        >
          {logoOk ? (
            // The same brand block as the other DTS portals: logo, then the
            // portal name in maroon. Drop the file at public/dts-logo.png.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/dts-logo.png"
              alt="DTS — Diversified Transportation Services"
              className="h-9 w-auto shrink-0"
              onError={() => setLogoOk(false)}
            />
          ) : null}
          <span className="leading-tight">Trade Show CRM</span>
        </Link>
        <a
          href="https://dts-ap-portal.vercel.app/"
          className="mt-2 block rounded px-1 py-0.5 font-heading text-[11px] font-medium text-slate-400 transition hover:bg-dts-blue/5 hover:text-dts-blue"
        >
          ← All portals
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section, si) => {
          const items = section.items.filter((item) => !item.adminOnly || role === "admin");
          if (items.length === 0) return null;
          return (
            <div key={section.title ?? `section-${si}`} className={si > 0 ? "mt-4" : ""}>
              {section.title ? (
                <div className="px-3 pb-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
              ) : null}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-3 rounded-md px-3 py-1.5 font-heading text-[13px] font-medium transition ${
                        active
                          ? "bg-dts-maroon text-white"
                          : "text-slate-600 hover:bg-dts-blue/5 hover:text-dts-blue"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        className={`h-[18px] w-[18px] ${active ? "text-white" : "text-slate-400"}`}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/account"
          onClick={onNavigate}
          title="Account · change password"
          className={`flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-slate-100 ${
            pathname.startsWith("/account") ? "bg-slate-100" : ""
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dts-maroon text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-slate-900">
              {userName}
            </div>
            <div className="truncate text-xs text-slate-500">{userEmail}</div>
          </div>
          {role === "admin" ? (
            <span className="rounded bg-dts-maroon px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Admin
            </span>
          ) : null}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 font-heading text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-dts-maroon"
          >
            <Icon name="signout" className="h-[18px] w-[18px] text-slate-400" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
