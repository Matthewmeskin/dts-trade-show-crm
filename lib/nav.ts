import type { IconName } from "@/components/icons";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Only show this item to admins (e.g. user management). */
  adminOnly?: boolean;
  /** Extra path prefixes that should light this item up (e.g. Quotes → Shipments). */
  match?: string[];
};

export type NavSection = {
  /** Optional heading shown above the group in the sidebar. */
  title?: string;
  items: NavItem[];
};

/** Primary navigation, grouped into sections (display order). */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: "dashboard" },
      { label: "Calendar", href: "/calendar", icon: "calendar" },
    ],
  },
  {
    title: "Shows & Freight",
    items: [
      { label: "Shows", href: "/shows", icon: "shows" },
      // Quotes lives as a tab on Shipments, so light Shipments up there too.
      { label: "Shipments", href: "/shipments", icon: "shipments", match: ["/quotes"] },
      { label: "MHA Check", href: "/mha-check", icon: "truck" },
    ],
  },
  {
    title: "Directory",
    items: [
      { label: "Exhibitors", href: "/exhibitors", icon: "exhibitors" },
      { label: "Carriers", href: "/carriers", icon: "carriers" },
      { label: "Venues", href: "/venues", icon: "venues" },
    ],
  },
  {
    title: "Review",
    items: [
      { label: "Load Finder", href: "/load-finder", icon: "sparkles" },
      { label: "Suggestions", href: "/suggestions", icon: "sparkles" },
      { label: "Tasks", href: "/tasks", icon: "tasks" },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: "reports" }],
  },
  {
    items: [{ label: "Users", href: "/users", icon: "users", adminOnly: true }],
  },
];

/** Flat list of every sidebar destination (active-state + command palette). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/**
 * Destinations reachable in the app but not shown as their own sidebar item
 * (they live as tabs / sub-pages). Kept searchable via the command palette.
 */
export const NAV_EXTRA: NavItem[] = [
  { label: "Quotes", href: "/quotes", icon: "documents" },
  { label: "Sales Calendar", href: "/shows/sales", icon: "calendar" },
];
