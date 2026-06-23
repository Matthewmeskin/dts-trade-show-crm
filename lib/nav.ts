import type { IconName } from "@/components/icons";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Only show this item to admins (e.g. user management). */
  adminOnly?: boolean;
};

/** Primary navigation, in display order. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Shows", href: "/shows", icon: "shows" },
  { label: "Venues", href: "/venues", icon: "venues" },
  { label: "Exhibitors", href: "/exhibitors", icon: "exhibitors" },
  { label: "Shipments", href: "/shipments", icon: "shipments" },
  { label: "Load Finder", href: "/load-finder", icon: "sparkles" },
  { label: "Carriers", href: "/carriers", icon: "carriers" },
  { label: "Tasks", href: "/tasks", icon: "tasks" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Users", href: "/users", icon: "users", adminOnly: true },
];
