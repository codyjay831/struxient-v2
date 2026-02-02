"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, ArrowRight, User, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface VaultEntry {
  id: string;
  flowId: string;
  workflowName: string;
  jobId: string;
  jobAddress: string | null;
  taskId: string;
  type: string;
  data: unknown;
  attachedAt: string;
  attachedBy: string;
}

interface VaultViewProps {
  customerId: string;
}

export function VaultView({ customerId }: VaultViewProps) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVault = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/vault`);
      if (!response.ok) throw new Error("Failed to fetch customer vault");
      const data = await response.json();
      setEntries(data.vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Aggregating evidence...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <Database className="h-12 w-12 text-muted-foreground/20 mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">No evidence artifacts found for this customer.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Database className="h-5 w-5 text-primary" />
          Customer Evidence Vault
        </CardTitle>
        <CardDescription>Consolidated inventory of artifacts across all jobs.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 border-t">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y border-b">
          {entries.map((entry) => (
            <div key={entry.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-wider">
                    {entry.type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(entry.attachedAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 rounded bg-primary/5 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate" title={entry.taskId}>
                      Task: {entry.taskId}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Flow: {entry.workflowName}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 p-2 rounded text-[10px] font-mono overflow-hidden">
                  <p className="truncate text-muted-foreground">
                    {typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data)}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-dashed space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{entry.attachedBy}</span>
                  </div>
                  <Link href={`/jobs/${entry.jobId}`} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Job Card <ArrowRight className="h-2 w-2" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
