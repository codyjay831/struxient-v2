"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, PlusCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OpenDetourDialogProps {
  flowId: string;
  nodeId: string;
  nodeName: string;
  checkpointTaskExecutionId: string;
  possibleResumeNodes: { id: string; name: string }[];
  onDetourOpened: () => void;
}

export function OpenDetourDialog({ 
  flowId, 
  nodeId, 
  nodeName, 
  checkpointTaskExecutionId, 
  possibleResumeNodes,
  onDetourOpened 
}: OpenDetourDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"NON_BLOCKING" | "BLOCKING">("NON_BLOCKING");
  const [resumeTargetNodeId, setResumeTargetNodeId] = useState<string>(possibleResumeNodes[0]?.id || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenDetour = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/flowspec/flows/${flowId}/detours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointNodeId: nodeId,
          checkpointTaskExecutionId,
          resumeTargetNodeId,
          type,
          category: "MANUAL_CORRECTION"
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to open detour");
      }

      setOpen(false);
      onDetourOpened();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Open Correction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Correction (Detour)</DialogTitle>
          <DialogDescription>
            Request a correction for work done in "{nodeName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Correction Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_BLOCKING">Non-Blocking (Continue other work)</SelectItem>
                <SelectItem value="BLOCKING">Blocking (Pause downstream work)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Resume Target (After Resolution)</Label>
            <Select value={resumeTargetNodeId} onValueChange={setResumeTargetNodeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select node to resume at" />
              </SelectTrigger>
              <SelectContent>
                {possibleResumeNodes.map(node => (
                  <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Stable Resume: Execution will return directly here without re-routing.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleOpenDetour} disabled={isLoading || !resumeTargetNodeId}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Open Detour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
