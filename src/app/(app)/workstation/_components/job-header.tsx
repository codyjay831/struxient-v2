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
import { Loader2, User, MapPin, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JobMetadata {
  id: string;
  address: string | null;
  customer: {
    name: string;
  };
}

interface JobHeaderProps {
  flowGroupId: string;
}

export function JobHeader({ flowGroupId }: JobHeaderProps) {
  const [job, setJob] = useState<JobMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobMetadata = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/by-flow-group/${flowGroupId}`);
      
      if (response.status === 404) {
        // Safe empty state per M1 requirements
        setJob(null);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch job metadata");
      }

      const data = await response.json();
      setJob(data.job);
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

  if (!job) {
    return (
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
          <Badge variant="outline" className="text-[10px]">METADATA MISSING</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
}
