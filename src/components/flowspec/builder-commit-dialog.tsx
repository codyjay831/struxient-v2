"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SemanticChange } from "@/lib/flowspec/diff";
import { 
  PlusCircleIcon, 
  Trash2Icon, 
  EditIcon, 
  ArrowRightCircleIcon,
  Loader2Icon
} from "lucide-react";

interface BuilderCommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: SemanticChange[];
  onConfirm: (label?: string) => Promise<void>;
}

export function BuilderCommitDialog({
  open,
  onOpenChange,
  changes,
  onConfirm
}: BuilderCommitDialogProps) {
  const [label, setLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(label);
      onOpenChange(false);
      setLabel("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = (kind: string) => {
    switch (kind) {
      case "NODE_ADDED":
      case "TASK_ADDED":
      case "GATE_ADDED":
        return <PlusCircleIcon className="size-3.5 text-green-600" />;
      case "NODE_REMOVED":
      case "TASK_REMOVED":
      case "GATE_REMOVED":
        return <Trash2Icon className="size-3.5 text-destructive" />;
      default:
        return <EditIcon className="size-3.5 text-blue-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Commit Semantic Changes</DialogTitle>
          <DialogDescription>
            Review the {changes.length} changes you've made. Committing will update the relational database and create a save event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="milestone-label" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Milestone Name (Optional)
            </Label>
            <Input 
              id="milestone-label"
              placeholder="e.g., Added detours for billing"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Change Summary
            </Label>
            <div className="h-[250px] overflow-y-auto rounded-md border p-3 bg-muted/20">
              <div className="space-y-3">
                {changes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No changes detected.</p>
                ) : (
                  changes.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="mt-0.5">{getIcon(change.kind)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{change.label}</p>
                        {change.details && (
                          <p className="text-muted-foreground mt-0.5">{change.details}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || changes.length === 0}>
            {isSubmitting ? (
              <Loader2Icon className="size-4 animate-spin mr-2" />
            ) : (
              <ArrowRightCircleIcon className="size-4 mr-2" />
            )}
            Commit Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
