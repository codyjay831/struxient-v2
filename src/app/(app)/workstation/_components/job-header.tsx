"use client";

/**
 * Job Header Component
 * 
 * Displays Job + Customer metadata for a selected Job (FlowGroup).
 * 
 * Canon Source: Phase 3 / Milestone M1 Foundation
 * - Job.flowGroupId is the canonical link to FlowSpec.
 * - Displays Customer Name + Address.
 * - Graceful empty state if Job details not configured.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, User, MapPin, AlertCircle, ShieldAlert, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface JobMetadata {
  id: string;
  address: string | null;
  customer: {
    name: string;
  };
}

interface BlockedFlow {
  id: string;
  workflowName: string;
}

interface JobHeaderProps {
  flowGroupId: string;
}

export function JobHeader({ flowGroupId }: JobHeaderProps) {
  const [job, setJob] = useState<JobMetadata | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedFlows, setBlockedFlows] = useState<BlockedFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobMetadata = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/by-flow-group/${flowGroupId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setJob(null);
          return;
        }
        throw new Error("Failed to fetch job metadata");
      }

      const data = await response.json();
      setJob(data.job);
      setIsBlocked(data.isBlocked);
      setBlockedFlows(data.blockedFlows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [flowGroupId]);

  useEffect(() => {
    fetchJobMetadata();
  }, [fetchJobMetadata]);

  if (isLoading) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading job details...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-center text-amber-800">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm">Error loading job details: {error}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Blocked Banner */}
      {isBlocked && (
        <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 shadow-sm animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle className="font-bold">EXECUTION BLOCKED</AlertTitle>
          <AlertDescription className="text-sm opacity-90">
            A critical error occurred during provisioning. One or more flows are halted:
            <ul className="list-disc list-inside mt-2 font-mono text-xs">
              {blockedFlows.map(f => (
                <li key={f.id}>{f.workflowName}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs italic">Contact an administrator to resolve this block.</p>
          </AlertDescription>
        </Alert>
      )}

      {!job ? (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground italic">
                Job details not configured
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                ID: {flowGroupId}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-[10px]">METADATA MISSING</Badge>
              <Link href={`/jobs?showAdmin=true&flowGroupId=${flowGroupId}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                  Link Metadata
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-lg">{job.customer.name}</h2>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm">{job.address || "No address provided"}</span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  JOB: {job.id}
                </Badge>
                <p className="text-[10px] text-muted-foreground font-mono">
                  FG: {flowGroupId}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
