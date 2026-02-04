"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info, ShieldAlert } from "lucide-react";

interface DetourBannerProps {
  detour: {
    status: 'ACTIVE' | 'RESOLVED' | 'CONVERTED';
    type: 'NON_BLOCKING' | 'BLOCKING';
  };
}

export function DetourBanner({ detour }: DetourBannerProps) {
  if (detour.status !== 'ACTIVE') return null;

  const isBlocking = detour.type === 'BLOCKING';

  return (
    <Alert variant={isBlocking ? "destructive" : "default"} className={isBlocking ? "border-red-500 bg-red-50" : "border-blue-500 bg-blue-50"}>
      {isBlocking ? <ShieldAlert className="h-4 w-4" /> : <Info className="h-4 w-4" />}
      <AlertTitle className="flex items-center gap-2">
        {isBlocking ? "Work Paused — fix required" : "Item Needed — continue other work"}
        <Badge variant={isBlocking ? "destructive" : "secondary"}>
          {isBlocking ? "BLOCKING" : "NON-BLOCKING"}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        {isBlocking 
          ? "This detour prevents downstream work. Record a valid outcome to resolve." 
          : "An active correction is requested for this task. You can still continue other work."}
      </AlertDescription>
    </Alert>
  );
}
