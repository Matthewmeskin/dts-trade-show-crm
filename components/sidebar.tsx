"use client";

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
}: {
  userName: string;
  userEmail: string;
  role: string;
}) {
  const pathname = usePathname();
  const initials =
    userName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-dts-blue text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dts-maroon text-sm font-bold text-white">
          DTS
        </div>
        <div className="leading-tight">
          <div className="font-heading text-sm font-semibold text-white">
            Trade Show
          </div>
          <div className="text-xs text-white/60">CRM</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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
