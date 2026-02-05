"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BuilderPanelProps {
  isOpen: boolean;
  side: "left" | "right";
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function BuilderPanel({
  isOpen,
  side,
  children,
  width = "320px",
  className,
}: BuilderPanelProps) {
  return (
    <div
      className={cn(
        "h-full overflow-hidden transition-all duration-300 ease-in-out bg-background border-muted shrink-0",
        side === "left" ? "border-r" : "border-l",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
      style={{
        width: isOpen ? width : "0px",
      }}
    >
      <div 
        className="h-full overflow-y-auto"
        style={{ width }} // Keep content width stable during slide
      >
        {children}
      </div>
    </div>
  );
}
