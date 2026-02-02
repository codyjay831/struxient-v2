"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link as LinkIcon, Briefcase, MapPin, User, AlertCircle, CheckCircle2, ArrowRight, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter, useSearchParams } from "next/navigation";

interface Customer {
  id: string;
  name: string;
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  domainHint?: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [flowGroups, setFlowGroups] = useState<FlowGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Start Job State
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [startCustomerId, setStartCustomerId] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([""]);

  // Linking state (Demoted)
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedFlowGroupId, setSelectedFlowGroupId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [address, setAddress] = useState("");

  // Handle URL params for recovery mode
  useEffect(() => {
    if (searchParams.get("showAdmin") === "true") {
      setShowAdmin(true);
    }
  }, [searchParams]);

  // Pre-select FlowGroup from URL when data is loaded
  useEffect(() => {
    const fgId = searchParams.get("flowGroupId");
    if (fgId && flowGroups.length > 0) {
      // Confirm the flowGroup exists in the loaded list before selecting
      const exists = flowGroups.some(fg => fg.id === fgId);
      if (exists) {
        setSelectedFlowGroupId(fgId);
      }
    }
  }, [searchParams, flowGroups]);

  const unlinkedFlowGroups = useMemo(() => {
    return flowGroups.filter(fg => !fg.job);
  }, [flowGroups]);

  const publishedWorkflows = useMemo(() => {
    return workflows.filter(wf => wf.status === "PUBLISHED");
  }, [workflows]);

  // Auto-select if only one option exists
  useEffect(() => {
    if (unlinkedFlowGroups.length === 1 && !selectedFlowGroupId) {
      setSelectedFlowGroupId(unlinkedFlowGroups[0].id);
    }
  }, [unlinkedFlowGroups, selectedFlowGroupId]);

  useEffect(() => {
    if (customers.length === 1 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setAdminError(null);
    try {
      const [jobsRes, fgsRes, custRes, wfRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/flowspec/flow-groups"),
        fetch("/api/customers"),
        fetch("/api/flowspec/workflows")
      ]);

      if (!jobsRes.ok || !fgsRes.ok || !custRes.ok || !wfRes.ok) {
        throw new Error("Failed to fetch organization data");
      }

      const [jobsData, fgsData, custData, wfData] = await Promise.all([
        jobsRes.json(),
        fgsRes.json(),
        custRes.json(),
        wfRes.json()
      ]);

      setJobs(jobsData.items);
      setFlowGroups(fgsData.items);
      setCustomers(custData.items);
      setWorkflows(wfData.items);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startCustomerId || selectedWorkflowIds.filter(Boolean).length === 0) {
      setStartError("Customer and at least one workflow are required.");
      return;
    }

    setIsSubmitting(true);
    setStartError(null);
    try {
      const response = await fetch("/api/jobs/start-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: startCustomerId,
          address: startAddress.trim() || undefined,
          workflowIds: selectedWorkflowIds.filter(Boolean),
          idempotencyKey: crypto.randomUUID()
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to start job");
      }
      
      setIsStartDialogOpen(false);
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      } else if (data.flowGroup?.id) {
        router.push(`/workstation?job=${data.flowGroup.id}`);
      } else {
        await fetchData();
      }
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlowGroupId || !selectedCustomerId) return;

    setIsSubmitting(true);
    setAdminError(null);
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
      setAdminError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-2">Manage and initiate customer job execution.</p>
        </div>
        
        <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md">
              <Plus className="mr-2 h-5 w-5" />
              Start New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Start New Job</DialogTitle>
              <DialogDescription>
                Initiate a new job execution immediately (Sales OFF).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleStartJob} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="start-customer">Customer</Label>
                <select
                  id="start-customer"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                  value={startCustomerId}
                  onChange={(e) => setStartCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-address">Service Address (Optional)</Label>
                <Input
                  id="start-address"
                  placeholder="123 Main St, Springfield"
                  value={startAddress}
                  onChange={(e) => setStartAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Workflow(s)</Label>
                <div className="space-y-2">
                  {selectedWorkflowIds.map((id, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        {index === 0 && <span className="text-[10px] text-muted-foreground font-medium uppercase">Anchor Workflow (required)</span>}
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                          value={id}
                          onChange={(e) => {
                            const newIds = [...selectedWorkflowIds];
                            newIds[index] = e.target.value;
                            setSelectedWorkflowIds(newIds);
                          }}
                          required
                        >
                          <option value="">Select workflow...</option>
                          {publishedWorkflows.map(wf => (
                            <option key={wf.id} value={wf.id}>{wf.name}</option>
                          ))}
                        </select>
                      </div>
                      {index > 0 && (
                        <div className="flex items-end pb-0.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            type="button"
                            onClick={() => setSelectedWorkflowIds(prev => prev.filter((_, i) => i !== index))}
                          >
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    className="w-full"
                    onClick={() => setSelectedWorkflowIds(prev => [...prev, ""])}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Another Workflow
                  </Button>
                </div>
              </div>

              {startError && (
                <div className="text-sm text-destructive font-medium p-2 bg-destructive/10 rounded flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {startError}
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsStartDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start Execution
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Jobs List */}
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <CardTitle>Active Jobs</CardTitle>
            <Badge variant="outline" className="font-mono">{jobs.length} Linked</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading organization data...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/20">
              <Briefcase className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium">No active jobs</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Start your first job to see it here.</p>
              <Button variant="outline" onClick={() => setIsStartDialogOpen(true)}>
                Start New Job
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <Card key={job.id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden border-muted/60">
                  <CardHeader className="p-5 bg-muted/10 border-b border-muted/40">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary/70" />
                          <span className="font-bold text-base leading-tight">{job.customer.name}</span>
                        </div>
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 mt-0.5" />
                          <span className="text-xs leading-snug">{job.address || "No address provided"}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono px-1.5 h-5 bg-background">JOB: {job.id.substring(0, 8)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Flow Group</span>
                        <p className="font-mono text-[11px] bg-muted/50 p-1 rounded truncate" title={job.flowGroupId}>{job.flowGroupId}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Created</span>
                        <p className="text-xs font-medium">{new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="pt-2">
                      <Link href={`/jobs/${job.id}`}>
                        <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          View Job Card
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin / Recovery Section (Demoted) */}
      <div className="mt-12 pt-12 border-t border-muted/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">Admin & Recovery</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAdmin(!showAdmin)}>
            {showAdmin ? <><ChevronUp className="mr-2 h-4 w-4" /> Hide</> : <><ChevronDown className="mr-2 h-4 w-4" /> Show Details</>}
          </Button>
        </div>
        
        {showAdmin && (
          <div className="space-y-6">
            <Alert variant="default" className="bg-muted/30 border-muted">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm">Manual Metadata Linking</AlertTitle>
              <AlertDescription className="text-xs">
                Use this tool only if a FlowGroup was started without a Job record or for legacy data recovery.
              </AlertDescription>
            </Alert>
            
            <div className="max-w-md">
              <Card className="bg-muted/10">
                <CardHeader>
                  <CardTitle className="text-base">Link Metadata</CardTitle>
                  <CardDescription className="text-xs">Assign a customer and address to an existing FlowGroup.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLinkJob} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="flowGroup" className="text-xs">FlowGroup (Execution ID)</Label>
                      <select
                        id="flowGroup"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:ring-1 focus:ring-ring"
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customer" className="text-xs">Customer</Label>
                      <select
                        id="customer"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:ring-1 focus:ring-ring"
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
                      <Label htmlFor="address" className="text-xs">Service Address (Optional)</Label>
                      <Input
                        id="address"
                        className="h-9 text-xs"
                        placeholder="123 Main St, Springfield"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    {adminError && (
                      <div className="flex items-center gap-2 text-[11px] text-destructive font-medium p-2 bg-destructive/10 rounded">
                        <AlertCircle className="h-3 w-3" />
                        <span>{adminError}</span>
                      </div>
                    )}

                    <Button type="submit" size="sm" className="w-full" disabled={isSubmitting || !selectedFlowGroupId || !selectedCustomerId}>
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <LinkIcon className="mr-2 h-3 w-3" />
                      )}
                      Link Job Metadata
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
