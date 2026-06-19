import type { IconName } from "@/components/icons";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

/** Primary navigation, in display order. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Shows", href: "/shows", icon: "shows" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Venues", href: "/venues", icon: "venues" },
  { label: "Exhibitors", href: "/exhibitors", icon: "exhibitors" },
  { label: "Shipments", href: "/shipments", icon: "shipments" },
  { label: "Load Finder", href: "/load-finder", icon: "sparkles" },
  { label: "Carriers", href: "/carriers", icon: "carriers" },
  { label: "Contacts", href: "/contacts", icon: "contacts" },
  { label: "Documents", href: "/documents", icon: "documents" },
  { label: "Tasks", href: "/tasks", icon: "tasks" },
  { label: "Reports", href: "/reports", icon: "reports" },
];
