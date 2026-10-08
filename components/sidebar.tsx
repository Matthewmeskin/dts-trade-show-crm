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
  // On desktop the collapsed sidebar is an icon rail, not gone: every
  // destination stays one click away and recognisable by its icon. The
  // phone drawer always shows the full menu.
  const rail = desktopCollapsed;
  // Classes that apply only on desktop while folded.
  const md = (cls: string) => (rail ? cls : "");
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
      className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 transition-transform duration-200 md:static md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${rail ? "md:w-14" : ""}`}
    >
      <div className={`border-b border-slate-200 px-3 py-2.5 ${md("md:px-0")}`}>
        <Link
          href="/"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 whitespace-nowrap font-heading text-[15px] font-bold text-dts-maroon ${md("md:justify-center")}`}
          aria-label="DTS Trade Show CRM — home"
          title="Trade Show CRM"
        >
          {logoOk ? (
            // The same brand block as the other DTS portals: the stacked
            // logo, then the portal name in maroon. The light file has black
            // lettering, the dark one white; the `dark` class picks which.
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dts-logo.png"
                alt="DTS — Diversified Transportation Services"
                className={`h-9 w-auto shrink-0 dark:hidden ${md("md:h-7")}`}
                onError={() => setLogoOk(false)}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dts-logo-dark.png"
                alt="DTS — Diversified Transportation Services"
                className={`hidden h-9 w-auto shrink-0 dark:block ${md("md:h-7")}`}
              />
            </>
          ) : null}
          <span className={`leading-tight ${md("md:hidden")}`}>Trade Show CRM</span>
        </Link>
        <a
          href="https://dts-ap-portal.vercel.app/"
          title="All portals"
          className={`mt-2 flex items-center gap-2 rounded px-1 py-0.5 font-heading text-[11px] font-medium text-slate-400 transition hover:bg-dts-blue/5 hover:text-dts-blue ${md("md:justify-center md:px-0")}`}
        >
          <Icon name="dashboard" className={`hidden h-4 w-4 ${md("md:block")}`} />
          <span className={md("md:hidden")}>← All portals</span>
        </a>
      </div>

      <nav className={`flex-1 overflow-y-auto px-3 py-2 ${md("md:px-1.5")}`}>
        {NAV_SECTIONS.map((section, si) => {
          const items = section.items.filter((item) => !item.adminOnly || role === "admin");
          if (items.length === 0) return null;
          return (
            <div
              key={section.title ?? `section-${si}`}
              className={si > 0 ? `mt-4 ${md("md:mt-2 md:border-t md:border-slate-200 md:pt-2")}` : ""}
            >
              {section.title ? (
                <div className={`px-3 pb-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${md("md:hidden")}`}>
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
                      title={item.label}
                      className={`flex items-center gap-3 rounded-md px-3 py-1.5 font-heading text-[13px] font-medium transition ${md("md:justify-center md:px-0 md:py-2")} ${
                        active
                          ? "bg-dts-maroon text-white"
                          : "text-slate-600 hover:bg-dts-blue/5 hover:text-dts-blue"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-400"}`}
                      />
                      <span className={md("md:hidden")}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={`border-t border-slate-200 p-3 ${md("md:px-1.5")}`}>
        <Link
          href="/account"
          onClick={onNavigate}
          title={`${userName} · ${userEmail} · Account`}
          className={`flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-slate-100 ${md("md:justify-center md:px-0")} ${
            pathname.startsWith("/account") ? "bg-slate-100" : ""
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dts-maroon text-xs font-semibold text-white">
            {initials}
          </div>
          <div className={`min-w-0 flex-1 leading-tight ${md("md:hidden")}`}>
            <div className="truncate text-sm font-medium text-slate-900">
              {userName}
            </div>
            <div className="truncate text-xs text-slate-500">{userEmail}</div>
          </div>
          {role === "admin" ? (
            <span className={`rounded bg-dts-maroon px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${md("md:hidden")}`}>
              Admin
            </span>
          ) : null}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 font-heading text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-dts-maroon ${md("md:justify-center md:px-0")}`}
          >
            <Icon name="signout" className="h-[18px] w-[18px] shrink-0 text-slate-400" />
            <span className={md("md:hidden")}>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
