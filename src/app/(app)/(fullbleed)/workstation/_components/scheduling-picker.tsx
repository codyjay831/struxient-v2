"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { format, addHours, parseISO, isValid, startOfHour, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";

interface SchedulingPickerProps {
  initialStartAt?: string;
  initialEndAt?: string;
  onRangeChange: (startAt: string, endAt: string) => void;
  type?: "INSTALL_APPOINTMENT" | "SITE_VISIT" | "INSPECTION" | "SUBCONTRACTOR_SLOT" | "MATERIAL_DELIVERY" | "OTHER";
}

const TYPE_EXPLANATIONS: Record<string, string> = {
  INSTALL_APPOINTMENT: "Captures the exact window when the installation crew will be on site.",
  SITE_VISIT: "Used for pre-installation site walks and measurements.",
  INSPECTION: "Coordinates with municipal inspectors for job sign-off.",
  SUBCONTRACTOR_SLOT: "Reserves a time block for external specialized trades.",
  MATERIAL_DELIVERY: "Tracks when equipment or supplies are arriving.",
  OTHER: "General time block for this task."
};

/**
 * First-Class Scheduling Picker
 * Optimized for speed and contractor UX.
 * Displays local time, stores/emits ISO.
 */
export function SchedulingPicker({
  initialStartAt,
  initialEndAt,
  onRangeChange,
  type,
}: SchedulingPickerProps) {
  // We manage date and times separately for easier UI manipulation
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndAt] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  // Initialize from props if provided
  useEffect(() => {
    if (initialStartAt && initialEndAt) {
      const start = new Date(initialStartAt);
      const end = new Date(initialEndAt);
      if (isValid(start) && isValid(end)) {
        setDate(format(start, "yyyy-MM-dd"));
        setStartTime(format(start, "HH:mm"));
        setEndAt(format(end, "HH:mm"));
      }
    } else {
      // Default to today at next whole hour
      const now = new Date();
      const start = addHours(startOfHour(now), 1);
      const end = addHours(start, 2);
      setDate(format(start, "yyyy-MM-dd"));
      setStartTime(format(start, "HH:mm"));
      setEndAt(format(end, "HH:mm"));
    }
  }, [initialStartAt, initialEndAt]);

  // Synchronize changes to parent
  useEffect(() => {
    if (!date || !startTime || !endTime) return;

    try {
      // Split components to avoid string parsing ambiguity
      const [year, month, day] = date.split("-").map(Number);
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      const startLocal = new Date(year, month - 1, day, startH, startM);
      const endLocal = new Date(year, month - 1, day, endH, endM);

      if (!isValid(startLocal) || !isValid(endLocal)) {
        setError("Invalid date or time format");
        return;
      }

      const startISO = startLocal.toISOString();
      const endISO = endLocal.toISOString();
      
      if (endLocal <= startLocal) {
        setError("End time must be after start time");
      } else {
        setError(null);
        onRangeChange(startISO, endISO);
      }
    } catch (e) {
      setError("Error calculating schedule window");
    }
  }, [date, startTime, endTime, onRangeChange]);

  const setDuration = (hours: number) => {
    if (!startTime) return;
    const start = new Date(`${date}T${startTime}`);
    const end = addHours(start, hours);
    setEndAt(format(end, "HH:mm"));
  };

  const setAllDay = () => {
    setStartTime("08:00");
    setEndAt("17:00");
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">Select Schedule Window</h3>
            {type && (
              <Badge variant="outline" className="text-[10px] uppercase border-primary/30 text-primary/80">
                {type.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          {type && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {TYPE_EXPLANATIONS[type]}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Date Selection */}
        <div className="space-y-1.5">
          <Label htmlFor="sched-date" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
            Date
          </Label>
          <Input
            id="sched-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-sm focus:ring-primary"
          />
        </div>

        {/* Start Time */}
        <div className="space-y-1.5">
          <Label htmlFor="sched-start" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
            Start Time
          </Label>
          <div className="relative">
            <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="sched-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9 text-sm pl-9 focus:ring-primary"
            />
          </div>
        </div>

        {/* End Time */}
        <div className="space-y-1.5">
          <Label htmlFor="sched-end" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
            End Time
          </Label>
          <div className="relative">
            <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="sched-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndAt(e.target.value)}
              className={cn(
                "h-9 text-sm pl-9 focus:ring-primary",
                error && "border-destructive focus:ring-destructive"
              )}
            />
          </div>
        </div>
      </div>

      {/* Duration Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Presets:</span>
        <Button variant="outline" size="xs" onClick={() => setDuration(1)} className="h-6 text-[10px]">1h</Button>
        <Button variant="outline" size="xs" onClick={() => setDuration(2)} className="h-6 text-[10px]">2h</Button>
        <Button variant="outline" size="xs" onClick={() => setDuration(4)} className="h-6 text-[10px]">4h</Button>
        <Button variant="outline" size="xs" onClick={setAllDay} className="h-6 text-[10px]">All Day</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-[11px] font-medium bg-destructive/10 p-2 rounded border border-destructive/20 transition-all">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
