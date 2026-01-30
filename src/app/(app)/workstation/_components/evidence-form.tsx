"use client";

/**
 * Evidence Form Component
 * 
 * Canon Source: 30_workstation_ui_api_map.md §4.1.3
 * WS-INV-011: Evidence Preservation on Failure
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, PlusCircle, AlertCircle, CheckCircle2 } from "lucide-react";

interface EvidenceFormProps {
  flowId: string;
  taskId: string;
  evidenceSchema: any | null;
  evidenceRequired: boolean;
  onAttached: () => void;
}

interface EvidenceDraft {
  type: "TEXT" | "STRUCTURED" | "FILE";
  textValue: string;
  structuredJsonText: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  idempotencyKey: string;
}

const generateIdempotencyKey = (taskId: string) => {
  return `ws-evidence-${taskId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

export function EvidenceForm({
  flowId,
  taskId,
  evidenceSchema,
  evidenceRequired,
  onAttached,
}: EvidenceFormProps) {
  // Determine initial type from schema
  const typeFromSchema = evidenceSchema?.type?.toUpperCase() || "TEXT";
  
  const [draft, setDraft] = useState<EvidenceDraft>(() => ({
    type: typeFromSchema as any,
    textValue: "",
    structuredJsonText: "",
    fileName: "",
    fileMimeType: "",
    fileSize: 0,
    idempotencyKey: generateIdempotencyKey(taskId),
  }));

  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Sync draft type with schema if it changes
  useEffect(() => {
    setDraft(d => ({ ...d, type: typeFromSchema as any }));
  }, [typeFromSchema]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setError(null);

    try {
      let data: any = {};
      
      if (draft.type === "TEXT") {
        if (!draft.textValue.trim() && evidenceRequired) {
          throw new Error("Text content is required");
        }
        data = { content: draft.textValue };
      } else if (draft.type === "STRUCTURED") {
        try {
          const parsed = JSON.parse(draft.structuredJsonText);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Must be a JSON object");
          }
          data = { content: parsed };
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : "Invalid JSON");
        }
      } else if (draft.type === "FILE") {
        if ((!draft.fileName || !draft.fileMimeType || draft.fileSize <= 0) && evidenceRequired) {
          throw new Error("All file metadata fields are required");
        }
        data = {
          name: draft.fileName,
          mimeType: draft.fileMimeType,
          size: draft.fileSize,
        };
      }

      const response = await fetch(
        `/api/flowspec/flows/${flowId}/tasks/${taskId}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: draft.type,
            data,
            idempotencyKey: draft.idempotencyKey,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to attach evidence");
      }

      setState("success");
      
      // Reset draft but with a NEW idempotency key for the next one
      setTimeout(() => {
        setDraft({
          type: typeFromSchema as any,
          textValue: "",
          structuredJsonText: "",
          fileName: "",
          fileMimeType: "",
          fileSize: 0,
          idempotencyKey: generateIdempotencyKey(taskId),
        });
        setState("idle");
        onAttached();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  };

  const updateDraft = (updates: Partial<EvidenceDraft>) => {
    setDraft(d => ({ ...d, ...updates }));
    if (state === "error" || state === "success") setState("idle");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-md p-4 bg-background shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-primary" />
          Add Evidence
        </h3>
        {evidenceRequired && (
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 border-amber-200">
            Required
          </Badge>
        )}
      </div>

      {draft.type === "TEXT" && (
        <div className="space-y-2">
          <Label htmlFor="text-evidence" className="text-xs">Notes / Content</Label>
          <Textarea
            id="text-evidence"
            placeholder="Enter evidence text here..."
            value={draft.textValue}
            onChange={(e) => updateDraft({ textValue: e.target.value })}
            className="min-h-[100px] text-sm"
            disabled={state === "submitting" || state === "success"}
          />
          {evidenceSchema?.description && (
            <p className="text-[10px] text-muted-foreground italic">{evidenceSchema.description}</p>
          )}
        </div>
      )}

      {draft.type === "STRUCTURED" && (
        <div className="space-y-2">
          <Label htmlFor="json-evidence" className="text-xs">Structured Data (JSON Object)</Label>
          <Textarea
            id="json-evidence"
            placeholder='{ "key": "value" }'
            value={draft.structuredJsonText}
            onChange={(e) => updateDraft({ structuredJsonText: e.target.value })}
            className="font-mono text-sm min-h-[120px]"
            disabled={state === "submitting" || state === "success"}
          />
          <p className="text-[10px] text-muted-foreground">
            {evidenceSchema?.description || "Enter valid JSON object."}
          </p>
        </div>
      )}

      {draft.type === "FILE" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="file-name" className="text-xs">File Name</Label>
            <Input
              id="file-name"
              placeholder="image.png"
              value={draft.fileName}
              onChange={(e) => updateDraft({ fileName: e.target.value })}
              className="text-sm"
              disabled={state === "submitting" || state === "success"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-mime" className="text-xs">MIME Type</Label>
            <Input
              id="file-mime"
              placeholder="image/png"
              value={draft.fileMimeType}
              onChange={(e) => updateDraft({ fileMimeType: e.target.value })}
              className="text-sm"
              disabled={state === "submitting" || state === "success"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-size" className="text-xs">Size (Bytes)</Label>
            <Input
              id="file-size"
              type="number"
              placeholder="1024"
              value={draft.fileSize || ""}
              onChange={(e) => updateDraft({ fileSize: parseInt(e.target.value) || 0 })}
              className="text-sm"
              disabled={state === "submitting" || state === "success"}
            />
          </div>
          <div className="col-span-2">
             <Alert className="py-2">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription className="text-[10px]">
                 File storage is pending. Enter metadata to satisfy requirements.
               </AlertDescription>
             </Alert>
          </div>
        </div>
      )}

      {state === "error" && error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs">Error</AlertTitle>
          <AlertDescription className="text-[10px]">{error}</AlertDescription>
        </Alert>
      )}

      {state === "success" && (
        <Alert className="py-2 border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-[10px] text-green-700">
            Evidence attached successfully.
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={state === "submitting" || state === "success"}
        className="w-full"
      >
        {state === "submitting" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          "Attach Evidence"
        )}
      </Button>
    </form>
  );
}
