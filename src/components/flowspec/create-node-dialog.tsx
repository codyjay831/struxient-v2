"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusIcon, Loader2Icon } from "lucide-react";

interface CreateNodeDialogProps {
  workflowId: string;
  onNodeCreated: () => void;
  disabled?: boolean;
}

export function CreateNodeDialog({ workflowId, onNodeCreated, disabled }: CreateNodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isEntry, setIsEntry] = useState(false);
  const [nodeKind, setNodeKind] = useState<"MAINLINE" | "DETOUR">("MAINLINE");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/flowspec/workflows/${workflowId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isEntry, nodeKind }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "Failed to create node");
        return;
      }

      onNodeCreated();
      setOpen(false);
      setName("");
      setIsEntry(false);
      setNodeKind("MAINLINE");
    } catch {
      setError("Failed to create node. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <PlusIcon className="size-4" />
          Add Node
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Node</DialogTitle>
            <DialogDescription>
              Create a new node in this workflow. Nodes contain tasks that define work to be done.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="node-name" className="text-sm font-medium">
                Node Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Review Documents"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-entry"
                checked={isEntry}
                onChange={(e) => setIsEntry(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="is-entry" className="text-sm">
                Mark as Entry Node (workflow starts here)
              </label>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Node Classification</label>
              <div className="flex bg-muted p-1 rounded-md">
                <button
                  type="button"
                  onClick={() => setNodeKind("MAINLINE")}
                  disabled={isLoading}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                    nodeKind === "MAINLINE"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Mainline
                </button>
                <button
                  type="button"
                  onClick={() => setNodeKind("DETOUR")}
                  disabled={isLoading}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                    nodeKind === "DETOUR"
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Detour
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight italic">
                {nodeKind === "MAINLINE" 
                  ? "Standard process step (Solid arrows)" 
                  : "Compensation or recovery path (Dashed arrows)"}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2Icon className="size-4 animate-spin" />}
              Create Node
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
