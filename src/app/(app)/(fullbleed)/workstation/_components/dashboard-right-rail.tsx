import React from "react";
import { CUSTOMER_MESSAGES_PLACEHOLDERS } from "../_lib/customer-messages-placeholder";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function DashboardRightRail() {
  return (
    <div className="w-[340px] border-l bg-card flex flex-col gap-8 p-6 overflow-y-auto">
      {/* Customer Messages - Phase 5 (INV-WS-02, INV-WS-03) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Customer Messages
            </h4>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
              READ ONLY
            </span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground italic">
            ({CUSTOMER_MESSAGES_PLACEHOLDERS.length} demo)
          </span>
        </div>
        
        <div className="p-3 border rounded-md bg-muted/20 space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">
            Messaging Pending
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Customer communications will appear here. Unified inbox setup is currently pending.
          </p>
        </div>

        <div className="space-y-4">
          {CUSTOMER_MESSAGES_PLACEHOLDERS.slice(0, 3).map((msg) => (
            <div key={msg.id} className="border-b border-border/50 pb-4 last:border-0 last:pb-0 group">
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-sm">{msg.customerName}</span>
                <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
              </div>
              <p className="text-xs text-secondary-foreground/80 line-clamp-2 mb-2 italic">
                "{msg.messagePreview}"
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border">
                    {msg.source}
                  </span>
                  <span className="text-[10px] text-blue-500 font-bold font-mono">
                    {msg.jobLabel}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  className="h-6 text-[10px] font-bold uppercase text-muted-foreground hover:text-blue-500 p-0"
                  asChild
                >
                  <a href={`/workstation?lens=jobs&job=${msg.jobId}`}>
                    View Job
                  </a>
                </Button>
              </div>
            </div>
          ))}
          {CUSTOMER_MESSAGES_PLACEHOLDERS.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              No customer messages yet.
            </p>
          )}
        </div>
      </section>

      {/* Safe Navigation */}
      <section className="space-y-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Safe Navigation
        </h4>
        <div className="space-y-2">
          {["Open Job Profile", "Open Customer CRM", "Capability Matrix", "Archive & Logs"].map(
            (link) => (
              <a
                key={link}
                href="#"
                className="flex items-center justify-between group py-1"
              >
                <span className="text-sm text-secondary-foreground group-hover:text-blue-500 transition-colors">
                  {link}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                  READ ONLY
                </span>
              </a>
            )
          )}
        </div>
      </section>

      {/* Recommended Next */}
      <section className="space-y-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Recommended Next
        </h4>
        <div className="space-y-2">
          {[
            "Approve 14 Pending Tasks",
            "Review Unassigned Leads",
            "Update Crew Capacity",
          ].map((action) => (
            <a
              key={action}
              href="#"
              className="flex items-center justify-between group py-1"
            >
              <span className="text-sm text-secondary-foreground group-hover:text-blue-500 transition-colors">
                {action}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                EXECUTION
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
