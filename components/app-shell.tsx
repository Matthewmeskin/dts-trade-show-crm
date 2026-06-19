"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { FlashToast } from "@/components/toast";
import { Icon } from "@/components/icons";

const COLLAPSE_KEY = "dts:sidebarCollapsed";

export function AppShell({
  userName,
  userEmail,
  role,
  children,
}: {
  userName: string;
  userEmail: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  // Restore the desktop sidebar collapsed state.
  useEffect(() => {
    setDesktopCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleDesktop = () =>
    setDesktopCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  // Global ⌘K / Ctrl+K to toggle the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-dts-bg">
      {/* Mobile drawer backdrop */}
      {mobileNav ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setMobileNav(false)}
          aria-hidden="true"
        />
      ) : null}

      <Sidebar
        userName={userName}
        userEmail={userEmail}
        role={role}
        mobileOpen={mobileNav}
        desktopCollapsed={desktopCollapsed}
        onNavigate={() => setMobileNav(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Mobile: open the drawer */}
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>

            {/* Desktop: collapse / show the sidebar */}
            <button
              type="button"
              onClick={toggleDesktop}
              className="-ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 md:flex"
              aria-label={desktopCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <Icon name="panel-left" className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 max-w-md flex-1 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white"
            >
              <Icon name="search" className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">Search…</span>
              <kbd className="hidden items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:flex">
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </div>
  );
}
