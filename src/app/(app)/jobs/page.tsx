"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link as LinkIcon, Briefcase, MapPin, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Customer {
  id: string;
  name: string;
}

interface Job {
  id: string;
  address: string | null;
  flowGroupId: string;
  customer: Customer;
  createdAt: string;
}

interface FlowGroup {
  id: string;
  scopeType: string;
  scopeId: string;
  createdAt: string;
  job?: Job | null;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [flowGroups, setFlowGroups] = useState<FlowGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Linking state
  const [selectedFlowGroupId, setSelectedFlowGroupId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [address, setAddress] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [jobsRes, fgsRes, custRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/flowspec/flow-groups"),
        fetch("/api/customers")
      ]);

      if (!jobsRes.ok || !fgsRes.ok || !custRes.ok) {
        throw new Error("Failed to fetch organization data");
      }

      const [jobsData, fgsData, custData] = await Promise.all([
        jobsRes.json(),
        fgsRes.json(),
        custRes.json()
      ]);

      setJobs(jobsData.items);
      setFlowGroups(fgsData.items);
      setCustomers(custData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const unlinkedFlowGroups = useMemo(() => {
    return flowGroups.filter(fg => !fg.job);
  }, [flowGroups]);

  const handleLinkJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlowGroupId || !selectedCustomerId) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowGroupId: selectedFlowGroupId,
          customerId: selectedCustomerId,
          address: address.trim() || undefined
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to link job");
      }
      
      setSuccess("Job linked successfully!");
      setSelectedFlowGroupId("");
      setSelectedCustomerId("");
      setAddress("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-2">Link FlowSpec execution units to customer metadata.</p>
        </div>
        <Badge variant="secondary" className="mb-1">M1 Management Surface</Badge>
      </div>

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Link Form */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Link Metadata</CardTitle>
              <CardDescription>Assign a customer and address to an active FlowGroup.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLinkJob} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flowGroup">FlowGroup (Execution ID)</Label>
                  <select
                    id="flowGroup"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedFlowGroupId}
                    onChange={(e) => setSelectedFlowGroupId(e.target.value)}
                    required
                    disabled={isSubmitting || unlinkedFlowGroups.length === 0}
                  >
                    <option value="">Select unlinked FlowGroup...</option>
                    {unlinkedFlowGroups.map(fg => (
                      <option key={fg.id} value={fg.id}>{fg.scopeId} ({fg.id.substring(0, 8)}...)</option>
                    ))}
                  </select>
                  {unlinkedFlowGroups.length === 0 && !isLoading && (
                    <p className="text-[10px] text-muted-foreground italic">No unlinked FlowGroups found.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <select
                    id="customer"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    disabled={isSubmitting || customers.length === 0}
                  >
                    <option value="">Select customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Service Address (Optional)</Label>
                  <Input
                    id="address"
                    placeholder="123 Main St, Springfield"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive font-medium p-2 bg-destructive/10 rounded">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting || !selectedFlowGroupId || !selectedCustomerId}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="mr-2 h-4 w-4" />
                  )}
                  Link Job Metadata
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Jobs List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Linked Jobs</CardTitle>
                <CardDescription>Execution units with established domain metadata.</CardDescription>
              </div>
              <Badge variant="outline">{jobs.length} Active</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">Loading organization data...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                  <Briefcase className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground font-medium">No linked jobs found</p>
                  <p className="text-xs text-muted-foreground mt-1">Link your first FlowGroup to metadata to see it here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobs.map((job) => (
                    <Card key={job.id} className="overflow-hidden">
                      <CardHeader className="p-4 bg-muted/30 border-b">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-primary" />
                              <span className="font-bold text-sm">{job.customer.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="text-[11px] truncate max-w-[150px]">{job.address || "No address"}</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[9px] font-mono">JOB: {job.id.substring(0, 8)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground uppercase font-semibold">FlowGroup</span>
                          <span className="font-mono bg-primary/5 px-1 rounded">{job.flowGroupId}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground uppercase font-semibold">Created</span>
                          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
