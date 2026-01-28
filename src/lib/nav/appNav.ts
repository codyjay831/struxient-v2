import {
  LayoutDashboard,
  Workflow,
  Briefcase,
  Users,
  DollarSign,
  Landmark,
  Shield,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { type ModuleKey, getModuleFlags } from "@/lib/modules/moduleFlags";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey: ModuleKey;
}

/**
 * All navigation items with their module associations.
 * Order matters - this is the display order.
 */
const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: "workstation",
    label: "Work Station",
    href: "/workstation",
    icon: LayoutDashboard,
    moduleKey: "workstation",
  },
  {
    id: "flowspec",
    label: "FlowSpec Builder",
    href: "/flowspec",
    icon: Workflow,
    moduleKey: "flowspec",
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/jobs",
    icon: Briefcase,
    moduleKey: "jobs",
  },
  {
    id: "customers",
    label: "Customers",
    href: "/customers",
    icon: Users,
    moduleKey: "customers",
  },
  {
    id: "sales",
    label: "Sales",
    href: "/sales",
    icon: DollarSign,
    moduleKey: "sales",
  },
  {
    id: "finance",
    label: "Finance",
    href: "/finance",
    icon: Landmark,
    moduleKey: "finance",
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    icon: Shield,
    moduleKey: "admin",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    moduleKey: "settings",
  },
];

/**
 * Get navigation items filtered by enabled modules.
 * Disabled modules will NOT appear in navigation.
 */
export function getEnabledNavItems(): NavItem[] {
  const moduleFlags = getModuleFlags();
  return ALL_NAV_ITEMS.filter((item) => moduleFlags[item.moduleKey]);
}

/**
 * Get all nav items regardless of module state.
 * Use for route validation, not for rendering nav.
 */
export function getAllNavItems(): NavItem[] {
  return ALL_NAV_ITEMS;
}

/**
 * Check if a route's module is enabled.
 */
export function isRouteModuleEnabled(pathname: string): boolean {
  const moduleFlags = getModuleFlags();
  const navItem = ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  
  if (!navItem) {
    // Route not in nav - allow access (might be a sub-route or special page)
    return true;
  }
  
  return moduleFlags[navItem.moduleKey];
}
