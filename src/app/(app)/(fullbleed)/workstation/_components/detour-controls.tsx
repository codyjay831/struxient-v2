"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowRightCircle, Loader2 } from "lucide-react";

interface DetourControlsProps {
  detourId: string;
  flowId: string;
  type: 'NON_BLOCKING' | 'BLOCKING';
  status: 'ACTIVE' | 'RESOLVED' | 'CONVERTED';
  onUpdated: () => void;
}

export function DetourControls({ detourId, flowId, type, status, onUpdated }: DetourControlsProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (status !== 'ACTIVE') return null;

  const handleEscalate = async () => {
    setIsLoading(true);
    try {
      await fetch(`/api/flowspec/flows/${flowId}/detours/${detourId}/escalate`, { method: "POST" });
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    setIsLoading(true);
    try {
      await fetch(`/api/flowspec/flows/${flowId}/detours/${detourId}/remediate`, { method: "POST" });
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {type === 'NON_BLOCKING' && (
        <Button variant="outline" size="sm" onClick={handleEscalate} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ShieldAlert className="mr-2 h-3 w-3" />}
          Escalate to Blocking
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={handleConvert} disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ArrowRightCircle className="mr-2 h-3 w-3" />}
        Convert to Remediation
      </Button>
    </div>
  );
}
