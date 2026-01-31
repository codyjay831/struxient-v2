"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Briefcase, MapPin, Clock, ExternalLink, History as HistoryIcon, Database, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { HistoryView } from "./_components/history-view";
import { VaultView } from "./_components/vault-view";

interface JobSummary {
  id: string;
  address: string | null;
  createdAt: string;
  flowGroupId: string;
  derivedSignal: string;
}

interface CustomerSummary {
  id: string;
  name: string;
  jobs: JobSummary[];
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "vault">("active");

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers/${id}/summary`);
      if (!response.ok) throw new Error("Failed to fetch customer summary");
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading customer details...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || "Customer not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{summary.name}</h1>
            <p className="text-muted-foreground">Customer Projection Surface</p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono">ID: {summary.id.substring(0, 8)}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="flex bg-muted/50 p-1 rounded-lg w-full max-w-2xl mx-auto">
          <Button 
            variant={activeTab === "active" ? "default" : "ghost"} 
            className="flex-1 gap-2 text-xs h-8"
            onClick={() => setActiveTab("active")}
          >
            <LayoutDashboard className="h-3 w-3" />
            Active Jobs
          </Button>
          <Button 
            variant={activeTab === "history" ? "default" : "ghost"} 
            className="flex-1 gap-2 text-xs h-8"
            onClick={() => setActiveTab("history")}
          >
            <HistoryIcon className="h-3 w-3" />
            Relationship History
          </Button>
          <Button 
            variant={activeTab === "vault" ? "default" : "ghost"} 
            className="flex-1 gap-2 text-xs h-8"
            onClick={() => setActiveTab("vault")}
          >
            <Database className="h-3 w-3" />
            Evidence Vault
          </Button>
        </div>

        {activeTab === "active" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Execution Units
                </CardTitle>
                <CardDescription>Live and historical jobs associated with this customer.</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.jobs.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Briefcase className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                    <p className="mt-4 text-sm text-muted-foreground">No jobs found for this customer.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {summary.jobs.map((job) => (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded bg-primary/5 flex items-center justify-center text-primary">
                              <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{job.address || "No Address Provided"}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant={
                              job.derivedSignal === "COMPLETED" ? "default" :
                              job.derivedSignal === "BLOCKED" ? "destructive" :
                              job.derivedSignal === "SUSPENDED" ? "outline" : "secondary"
                            }>
                              {job.derivedSignal}
                            </Badge>
                            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "history" && (
          <HistoryView customerId={id as string} />
        )}

        {activeTab === "vault" && (
          <VaultView customerId={id as string} />
        )}
      </div>
    </div>
  );
}
