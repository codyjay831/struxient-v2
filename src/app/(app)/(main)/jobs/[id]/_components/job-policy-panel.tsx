"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertCircle, Save, Clock, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SnapshotTask {
  taskId: string;
  taskName: string;
  defaultSlaHours: number | null;
}

interface TaskPolicyOverride {
  taskId: string;
  slaHours: number | null;
}

interface Policy {
  jobPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  groupDueAt: string | null;
  taskOverrides: TaskPolicyOverride[];
}

interface JobPolicyPanelProps {
  flowGroupId: string;
}

export function JobPolicyPanel({ flowGroupId }: JobPolicyPanelProps) {
  const [snapshotTasks, setSnapshotTasks] = useState<SnapshotTask[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [priority, setPriority] = useState<Policy["jobPriority"]>("NORMAL");
  const [dueAt, setDueAt] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [snapshotRes, policyRes] = await Promise.all([
        fetch(`/api/flowspec/flow-groups/${flowGroupId}/snapshot-tasks`),
        fetch(`/api/flowspec/flow-groups/${flowGroupId}/policy`)
      ]);

      if (!snapshotRes.ok) throw new Error("Failed to fetch snapshot tasks");
      if (!policyRes.ok) throw new Error("Failed to fetch policy");

      const snapshotData = await snapshotRes.json();
      const policyData = await policyRes.json();

      setSnapshotTasks(snapshotData.tasks);
      const p = policyData.policy as Policy;
      setPolicy(p);

      // Initialize form
      setPriority(p.jobPriority);
      setDueAt(p.groupDueAt ? new Date(p.groupDueAt).toISOString().slice(0, 16) : "");
      
      const overrideMap: Record<string, number | null> = {};
      p.taskOverrides.forEach(o => {
        overrideMap[o.taskId] = o.slaHours;
      });
      setOverrides(overrideMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [flowGroupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const taskOverrides = Object.entries(overrides)
        .filter(([_, val]) => val !== undefined)
        .map(([taskId, slaHours]) => ({ taskId, slaHours }));

      const res = await fetch(`/api/flowspec/flow-groups/${flowGroupId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPriority: priority,
          groupDueAt: dueAt ? new Date(dueAt).toISOString() : null,
          taskOverrides
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save policy");
      }

      setSuccessMessage("Policy saved successfully");
      await fetchData(); // Refresh
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const updateOverride = (taskId: string, value: string) => {
    const hours = value === "" ? null : parseInt(value, 10);
    if (hours !== null && (isNaN(hours) || hours < 0 || hours > 999)) return;
    
    setOverrides(prev => ({
      ...prev,
      [taskId]: hours
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="shadow-sm border-primary/10">
      <CardHeader className="pb-3 border-b bg-muted/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Policy Control</CardTitle>
              <CardDescription className="text-xs">Timing & Priority Overrides (B &gt; A &gt; null)</CardDescription>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={isSaving}
            className="h-8"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
            Save Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold">Save Failed</AlertTitle>
            <AlertDescription className="text-[10px]">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="py-2 border-green-500 bg-green-50">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-xs font-medium text-green-700">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Job Priority</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <p className="text-[9px] text-muted-foreground italic">Affects dashboard signals only.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Group Due Date</Label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[9px] text-muted-foreground italic">Optional deadline for the entire Flow Group.</p>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task SLA Overrides (Hours)</Label>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="p-2 pl-4">Task Name</th>
                  <th className="p-2 text-center">Default (A)</th>
                  <th className="p-2 text-center">Override (B)</th>
                  <th className="p-2 text-center pr-4">Effective</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {snapshotTasks.map((task) => {
                  const override = overrides[task.taskId] ?? null;
                  const effective = override ?? task.defaultSlaHours ?? "None";
                  
                  return (
                    <tr key={task.taskId} className="hover:bg-muted/20 transition-colors">
                      <td className="p-2 pl-4">
                        <p className="font-medium text-xs">{task.taskName}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">{task.taskId}</p>
                      </td>
                      <td className="p-2 text-center text-xs text-muted-foreground">
                        {task.defaultSlaHours ?? "—"}
                      </td>
                      <td className="p-2 text-center">
                        <Input
                          type="number"
                          placeholder="Hours"
                          value={override === null ? "" : override}
                          onChange={(e) => updateOverride(task.taskId, e.target.value)}
                          className="h-7 w-20 mx-auto text-center text-xs"
                          min="0"
                          max="999"
                        />
                      </td>
                      <td className="p-2 text-center pr-4">
                        <Badge variant={override !== null ? "default" : "outline"} className="text-[10px] h-5">
                          {effective}h
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {snapshotTasks.length === 0 && (
            <p className="text-center py-4 text-xs text-muted-foreground">No tasks found in workflow snapshot.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
