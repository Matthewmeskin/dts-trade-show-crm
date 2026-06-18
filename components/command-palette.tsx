"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { NAV_ITEMS } from "@/lib/nav";
import type { SearchGroup, SearchHit } from "@/app/api/search/route";

type Command = {
  label: string;
  sublabel?: string;
  icon: IconName;
  href: string;
};

const NAV_COMMANDS: Command[] = NAV_ITEMS.map((n) => ({
  label: n.label,
  icon: n.icon,
  href: n.href,
}));

const CREATE_COMMANDS: Command[] = [
  { label: "New show", icon: "shows", href: "/shows/new" },
  { label: "New shipment", icon: "shipments", href: "/shipments/new" },
  { label: "New exhibitor", icon: "exhibitors", href: "/exhibitors/new" },
  { label: "New contact", icon: "contacts", href: "/contacts/new" },
  { label: "New carrier", icon: "carriers", href: "/carriers/new" },
  { label: "New venue", icon: "venues", href: "/venues/new" },
  { label: "New task", icon: "tasks", href: "/tasks/new" },
  { label: "Upload document", icon: "documents", href: "/documents/new" },
];

type Section = { heading: string; items: Command[] };

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  // Reset state each time the palette opens, and focus the input.
  useEffect(() => {
    if (open) {
      setQ("");
      setGroups([]);
      setActive(0);
      // Focus after paint so the autoFocus race is avoided.
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced record search.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 1) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { groups: SearchGroup[] };
        setGroups(json.groups ?? []);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setGroups([]);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [q, open]);

  const sections: Section[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      return [
        { heading: "Go to", items: NAV_COMMANDS },
        { heading: "Create", items: CREATE_COMMANDS },
      ];
    }
    const out: Section[] = [];
    const matchedActions = [...NAV_COMMANDS, ...CREATE_COMMANDS].filter((c) =>
      c.label.toLowerCase().includes(term),
    );
    if (matchedActions.length)
      out.push({ heading: "Actions", items: matchedActions });
    for (const g of groups) {
      out.push({
        heading: g.heading,
        items: g.items.map((h: SearchHit) => ({
          label: h.label,
          sublabel: h.sublabel,
          icon: h.icon,
          href: h.href,
        })),
      });
    }
    return out;
  }, [q, groups]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Keep the active index valid as results change.
  useEffect(() => {
    setActive((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  const select = useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return;
      onClose();
      router.push(cmd.href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll the active row into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const term = q.trim();
  const showEmpty = term.length >= 1 && !loading && flat.length === 0;

  // Running counter so each row gets a stable flat index for keyboard nav.
  let idx = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh] sm:pt-[16vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search and commands"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search shows, shipments, exhibitors, contacts…"
            className="h-14 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {loading ? (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-dts-maroon" />
          ) : (
            <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
              ESC
            </kbd>
          )}
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {showEmpty ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">
              No results for “{term}”.
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.heading} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {section.heading}
                </div>
                {section.items.map((cmd) => {
                  idx += 1;
                  const myIdx = idx;
                  const isActive = myIdx === active;
                  return (
                    <button
                      key={`${section.heading}-${cmd.href}-${myIdx}`}
                      type="button"
                      data-idx={myIdx}
                      onMouseMove={() => setActive(myIdx)}
                      onClick={() => select(cmd)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "bg-dts-maroon/8 text-dts-maroon"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon
                        name={cmd.icon}
                        className={`h-[18px] w-[18px] shrink-0 ${
                          isActive ? "text-dts-maroon" : "text-slate-400"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {cmd.label}
                      </span>
                      {cmd.sublabel ? (
                        <span className="shrink-0 truncate text-xs text-slate-400">
                          {cmd.sublabel}
                        </span>
                      ) : null}
                      {isActive ? (
                        <Icon
                          name="enter"
                          className="h-4 w-4 shrink-0 text-dts-maroon/70"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 px-1">↑</kbd>
              <kbd className="rounded border border-slate-200 px-1">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 px-1">↵</kbd>
              to open
            </span>
          </span>
          <span className="font-medium text-slate-400">DTS Trade Show CRM</span>
        </div>
      </div>
    </div>
  );
}
