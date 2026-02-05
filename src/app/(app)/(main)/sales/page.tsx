"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Target, AlertCircle, ArrowRight, ShieldAlert, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { isModuleEnabled } from "@/lib/modules/moduleFlags";
import { redirect } from "next/navigation";
import Link from "next/link";

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

interface FlowGroup {
  id: string;
  scopeType: string;
  scopeId: string;
  createdAt: string;
  isBlocked: boolean;
  job: any | null;
}

export default function SalesPage() {
  // Check if module is enabled
  if (!isModuleEnabled("sales")) {
    redirect("/workstation");
  }

  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [flowGroups, setFlowGroups] = useState<FlowGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [custRes, wfRes, fgRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/flowspec/workflows"),
        fetch("/api/flowspec/flow-groups")
      ]);
      const [custData, wfData, fgData] = await Promise.all([
        custRes.json(),
        wfRes.json(),
        fgRes.json()
      ]);
      setCustomers(custData.items || []);
      setWorkflows(wfData.items || []);
      setFlowGroups(fgData.items || []);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const opportunities = useMemo(() => {
    return flowGroups.filter(fg => 
      (fg.scopeType === "opportunity" || fg.scopeId.startsWith("oppty_")) && 
      fg.job === null
    );
  }, [flowGroups]);

  const salesWorkflows = useMemo(() => {
    const published = workflows.filter(wf => wf.status === "PUBLISHED");
    // Simple filter since domainHint is not in API
    return published.filter(wf => wf.name.toLowerCase().includes("sales"));
  }, [workflows]);

  const handleStartOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedWorkflowId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/sales/start-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          salesWorkflowId: selectedWorkflowId,
          idempotencyKey: crypto.randomUUID()
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to start opportunity");
      }

      setIsDialogOpen(false);
      router.push(`/workstation?lens=jobs&job=${data.flowGroup.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground mt-2">Manage and track active sales opportunities.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-5 w-5" />
              New Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Sales Opportunity</DialogTitle>
              <DialogDescription>
                Initiate a new sales track for a customer.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleStartOpportunity} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer (Required)</Label>
                <select
                  id="customer"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflow">Sales Workflow (Required)</Label>
                <select
                  id="workflow"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  required
                >
                  <option value="">Select sales workflow...</option>
                  {salesWorkflows.map(wf => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground italic">
                  Note: Only workflows designated for Sales can be started here.
                </p>
              </div>

              {error && (
                <div className="text-sm text-destructive font-medium p-2 bg-destructive/10 rounded flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start Opportunity
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Loading opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <Card className="col-span-full border-dashed bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <Target className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-muted-foreground">No Active Opportunities</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8">
                Opportunities appear here once started. They are execution contexts waiting to become Jobs.
              </p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Opportunity
              </Button>
            </CardContent>
          </Card>
        ) : (
          opportunities.map((opp) => (
            <Card key={opp.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant={opp.isBlocked ? "destructive" : "secondary"} className="uppercase text-[10px]">
                    {opp.isBlocked ? "Blocked" : "Active"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {opp.scopeId.split('_')[1]?.substring(0, 8) || opp.id.substring(0, 8)}
                  </span>
                </div>
                <CardTitle className="text-lg mt-2 font-bold truncate">
                  Opportunity Context
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  Started {new Date(opp.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {opp.isBlocked && (
                  <div className="flex items-center gap-2 p-2 rounded bg-destructive/5 text-destructive text-[10px] font-medium border border-destructive/10">
                    <ShieldAlert className="h-3 w-3" />
                    <span>Provisioning halted. Admin required.</span>
                  </div>
                )}
                
                <Link href={`/workstation?lens=jobs&job=${opp.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2 group">
                    Open in Work Station
                    <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
