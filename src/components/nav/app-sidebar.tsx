"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft, Menu } from "lucide-react";
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
  const { collapsed, toggle } = useSidebar();

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
          {!collapsed && (
            <Link href="/workstation" className="flex items-center gap-2">
              <Image
                src="/struxient_brand_assets/struxient-mark-32.png"
                alt="Struxient"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <span className="font-semibold text-sidebar-foreground">
                Struxient
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/workstation">
              <Image
                src="/struxient_brand_assets/struxient-mark-32.png"
                alt="Struxient"
                width={24}
                height={24}
                className="h-6 w-6"
              />
            </Link>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className={cn(
                  "h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "absolute right-0 translate-x-1/2 bg-sidebar border border-sidebar-border rounded-full shadow-sm z-10"
                )}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <SidebarContent collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
}
