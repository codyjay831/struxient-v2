"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2Icon } from "lucide-react";

interface CreateNextNodeDialogProps {
  workflowId: string;
  sourceNodeId: string;
  sourceNodeName: string;
  outcomeName: string;
  sourcePosition?: { x: number; y: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (newNodeId: string) => void;
  mode: "standard" | "assisted";
}

export function CreateNextNodeDialog({
  workflowId,
  sourceNodeId,
  sourceNodeName,
  outcomeName,
  sourcePosition,
  open,
  onOpenChange,
  onCreated,
  mode,
}: CreateNextNodeDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Prefill name only in assisted mode
  useEffect(() => {
    if (open) {
      if (mode === "assisted") {
        setName(`Handle ${outcomeName}`);
      } else {
        setName("");
      }
      setError(null);
    }
  }, [open, outcomeName, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setError(null);
    setIsLoading(true);

    try {
      // 1. Calculate position (assisted mode only)
      const X_GAP = 200;
      const position = (mode === "assisted" && sourcePosition) 
        ? { x: sourcePosition.x + X_GAP, y: sourcePosition.y }
        : undefined;

      // 2. Create the new node
      const nodeResponse = await fetch(`/api/flowspec/workflows/${workflowId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          isEntry: false, 
          nodeKind: "MAINLINE",
          position 
        }),
      });

      const nodeData = await nodeResponse.json();

      if (!nodeResponse.ok) {
        setError(nodeData.error?.message || "Failed to create node");
        setIsLoading(false);
        return;
      }

      const newNodeId = nodeData.node.id;

      // 3. Create the route (gate) - BOTH modes route automatically
      const gateResponse = await fetch(`/api/flowspec/workflows/${workflowId}/gates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNodeId,
          outcomeName,
          targetNodeId: newNodeId,
        }),
      });

      if (!gateResponse.ok) {
        const gateData = await gateResponse.json();
        setError(gateData.error?.message || "Node created, but failed to set route");
        setIsLoading(false);
        // Note: Node is created but route failed. User might need to set it manually.
        // We still trigger onCreated to refresh the UI so the new node shows up.
        onCreated(newNodeId);
        return;
      }

      onCreated(newNodeId);
      onOpenChange(false);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "assisted" ? "Assisted Create & Route" : "Create Next Node"}
            </DialogTitle>
            <DialogDescription>
              {mode === "assisted" 
                ? `Suggested handle for ${outcomeName} from ${sourceNodeName}.`
                : `Create a new node to handle the ${outcomeName} outcome from ${sourceNodeName}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="next-node-name" className="text-sm font-medium">
                Node Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="next-node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "assisted" ? `Handle ${outcomeName}` : "e.g., Review Results"}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2Icon className="size-4 animate-spin mr-2" />}
              {mode === "assisted" ? "Create & Route" : "Create Node"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
