"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface BuilderRailProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  side: "left" | "right";
  statusColor?: string; // e.g., "bg-green-500", "bg-amber-500"
  className?: string;
}

export function BuilderRail({
  icon: Icon,
  label,
  active,
  onClick,
  side,
  statusColor,
  className,
}: BuilderRailProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center py-4 gap-4 w-[42px] h-full transition-all duration-200 group select-none relative",
        "bg-muted/10 hover:bg-muted/30 border-muted",
        side === "left" ? "border-r" : "border-l",
        active && "bg-background shadow-[inset_0_0_10px_rgba(0,0,0,0.05)]",
        active && side === "left" && "border-r-transparent",
        active && side === "right" && "border-l-transparent",
        className
      )}
    >
      {/* Active Indicator Rail */}
      {active && (
        <div 
          className={cn(
            "absolute inset-y-0 w-0.5 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]",
            side === "left" ? "left-0" : "right-0"
          )} 
        />
      )}

      {/* Status Dot */}
      {statusColor && (
        <div className={cn("size-2 rounded-full absolute top-2", statusColor, "shadow-sm")} />
      )}

      <Icon className={cn(
        "size-4 transition-colors",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )} />
      
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-colors",
        "[writing-mode:vertical-rl] rotate-180", 
        active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
      )}>
        {label}
      </span>
    </button>
  );
}
