"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkflowStatusBadge, WorkflowStatus } from "@/components/flowspec/workflow-status-badge";
import { CreateWorkflowDialog } from "@/components/flowspec/create-workflow-dialog";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2Icon, 
  RefreshCwIcon, 
  TrashIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  BuildingIcon
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowListResponse {
  items: Workflow[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
  };
}

export default function FlowSpecPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noMembership, setNoMembership] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNoMembership(false);
    try {
      const response = await fetch("/api/flowspec/workflows");
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.code === "NO_MEMBERSHIP") {
          setNoMembership(true);
          return;
        }
        throw new Error(data.error?.message || "Failed to fetch workflows");
      }
      
      setWorkflows(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workflows");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsCreatingCompany(true);
    setError(null);
    try {
      const response = await fetch("/api/tenancy/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create company");
      }

      // Success! Refresh workflows (which should now succeed)
      setNoMembership(false);
      setNewCompanyName("");
      fetchWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setIsCreatingCompany(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleWorkflowCreated = (workflow: { id: string; name: string }) => {
    router.push(`/flowspec/${workflow.id}`);
  };

  const handleDeleteWorkflow = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/flowspec/workflows/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete workflow");
      }

      setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workflow");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (noMembership) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto text-primary">
            <BuildingIcon className="size-12" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Welcome to Struxient</h1>
          <p className="text-xl text-muted-foreground">
            To start designing workflows, you first need to create your company instance.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Create Your Company</CardTitle>
            <CardDescription>
              This will be the dedicated space for all your organization's workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="space-y-2 text-left">
                <label htmlFor="companyName" className="text-sm font-medium">
                  Company Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  placeholder="e.g. Acme Corp"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  disabled={isCreatingCompany}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isCreatingCompany}>
                {isCreatingCompany && <Loader2Icon className="size-4 animate-spin mr-2" />}
                Get Started
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive w-full">
            <AlertCircleIcon className="size-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">FlowSpec Builder</h1>
          <p className="text-muted-foreground mt-1">
            Design and manage workflow specifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchWorkflows}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCwIcon className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={() => router.push("/templates")}>
            Browse Templates
          </Button>
          <CreateWorkflowDialog onWorkflowCreated={handleWorkflowCreated} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertCircleIcon className="size-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workflow Specifications</CardTitle>
          <CardDescription>
            Create and edit FlowSpecs that define how work moves through your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No workflows yet. Create your first workflow to get started.
              </p>
              <CreateWorkflowDialog onWorkflowCreated={handleWorkflowCreated} />
            </div>
          ) : (
            <div className="divide-y">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 group"
                >
                  <button
                    onClick={() => router.push(`/flowspec/${workflow.id}`)}
                    className="flex-1 flex items-center gap-4 text-left hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{workflow.name}</h3>
                        <WorkflowStatusBadge status={workflow.status} />
                        {workflow.version > 1 && (
                          <span className="text-xs text-muted-foreground">
                            v{workflow.version}
                          </span>
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {workflow.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated {formatDate(workflow.updatedAt)}
                      </p>
                    </div>
                    <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  
                  {/* Delete button - only for DRAFT workflows (INV-011) */}
                  {workflow.status === "DRAFT" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(workflow);
                      }}
                      title="Delete workflow"
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWorkflow}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2Icon className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
