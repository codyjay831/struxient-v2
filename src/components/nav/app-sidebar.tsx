"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PanelLeftClose, Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";
import { getEnabledNavItems, type NavItem } from "@/lib/nav/appNav";

function NavItemLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{item.label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const navItems = getEnabledNavItems();

  return (
    <div className="flex h-full flex-col">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <NavItemLink
              key={item.id}
              item={item}
              isActive={isActive}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t border-sidebar-border p-2",
          collapsed ? "flex flex-col items-center gap-2" : "space-y-1"
        )}
      >
        <ThemeToggle collapsed={collapsed} />
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "px-3 py-2"
          )}
        >
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MobileSidebar() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden fixed top-4 left-4 z-40"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
            <Image
              src="/struxient_brand_assets/struxient-mark-32.png"
              alt="Struxient"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="font-semibold">Struxient</span>
          </SheetTitle>
        </SheetHeader>
        <div onClick={() => setOpen(false)}>
          <SidebarContent collapsed={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppSidebar() {
  const { collapsed, setCollapsed, toggle } = useSidebar();

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile sidebar (drawer) */}
      <MobileSidebar />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* Header with logo and collapse toggle */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm transition-all",
              collapsed ? "cursor-pointer" : "cursor-default"
            )}
            onClick={() => collapsed && setCollapsed(false)}
            onKeyDown={(e) => {
              if (collapsed && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setCollapsed(false);
              }
            }}
            aria-label={collapsed ? "Expand sidebar" : "Struxient Home"}
            aria-disabled={!collapsed}
            data-testid="sidebar-logo"
          >
            <Image
              src="/struxient_brand_assets/struxient-mark-32.png"
              alt="Struxient"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            {!collapsed && (
              <span className="font-semibold text-sidebar-foreground">
                Struxient
              </span>
            )}
          </button>
          {/* Collapse toggle - only shown when expanded (logo handles expansion when collapsed) */}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggle}
                  className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                  <span className="sr-only">Collapse sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Collapse sidebar</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <SidebarContent collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
}
