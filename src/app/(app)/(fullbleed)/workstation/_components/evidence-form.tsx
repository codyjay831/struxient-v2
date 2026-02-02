"use client";

/**
 * Evidence Form Component
 * 
 * Canon Source: 30_workstation_ui_api_map.md §4.1.3
 * WS-INV-011: Evidence Preservation on Failure
 *
 * Supports:
 * - TEXT evidence: Free-form text input
 * - STRUCTURED evidence: JSON object input
 * - FILE evidence: Real file upload via signed S3 URL
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, AlertCircle, CheckCircle2, Upload, File } from "lucide-react";
import { apiAttachEvidence, apiGetSignedUploadUrl, uploadFileToStorage } from "../_lib/execution-adapter";

interface EvidenceFormProps {
  flowId: string;
  taskId: string;
  evidenceSchema: { type?: string; description?: string } | null;
  evidenceRequired: boolean;
  onAttached: () => void;
}

interface EvidenceDraft {
  type: "TEXT" | "STRUCTURED" | "FILE";
  textValue: string;
  structuredJsonText: string;
  // File fields
  selectedFile: File | null;
  idempotencyKey: string;
}

type UploadState = "idle" | "getting-url" | "uploading" | "attaching" | "success" | "error";

const generateIdempotencyKey = (taskId: string) => {
  return `ws-evidence-${taskId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function EvidenceForm({
  flowId,
  taskId,
  evidenceSchema,
  evidenceRequired,
  onAttached,
}: EvidenceFormProps) {
  // Determine initial type from schema
  const schema = evidenceSchema as { type?: string; description?: string } | null;
  const typeFromSchema = schema?.type?.toUpperCase() || "TEXT";
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [draft, setDraft] = useState<EvidenceDraft>(() => ({
    type: (typeFromSchema as any) === "STRUCTURED" ? "STRUCTURED" : (typeFromSchema as any) === "FILE" ? "FILE" : "TEXT",
    textValue: "",
    structuredJsonText: "",
    selectedFile: null,
    idempotencyKey: generateIdempotencyKey(taskId),
  }));

  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // Sync draft type with schema if it changes
  useEffect(() => {
    setDraft(d => ({ ...d, type: typeFromSchema as any }));
  }, [typeFromSchema]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateDraft({ selectedFile: file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      let data: any = {};
      
      if (draft.type === "TEXT") {
        setState("attaching");
        if (!draft.textValue.trim() && evidenceRequired) {
          throw new Error("Text content is required");
        }
        data = { content: draft.textValue };
        await apiAttachEvidence(flowId, taskId, draft.type, data, draft.idempotencyKey);
        
      } else if (draft.type === "STRUCTURED") {
        setState("attaching");
        try {
          const parsed = JSON.parse(draft.structuredJsonText);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Must be a JSON object");
          }
          data = { content: parsed };
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : "Invalid JSON");
        }
        await apiAttachEvidence(flowId, taskId, draft.type, data, draft.idempotencyKey);
        
      } else if (draft.type === "FILE") {
        // Real file upload flow: get signed URL -> upload -> attach pointer
        if (!draft.selectedFile && evidenceRequired) {
          throw new Error("Please select a file");
        }
        
        if (draft.selectedFile) {
          const file = draft.selectedFile;
          
          // Step 1: Get signed upload URL
          setState("getting-url");
          setUploadProgress("Getting upload URL...");
          const { uploadUrl, storageKey, bucket } = await apiGetSignedUploadUrl(
            flowId,
            taskId,
            file.name,
            file.type || "application/octet-stream"
          );
          
          // Step 2: Upload file to S3
          setState("uploading");
          setUploadProgress(`Uploading ${formatFileSize(file.size)}...`);
          await uploadFileToStorage(uploadUrl, file);
          
          // Step 3: Attach evidence pointer
          setState("attaching");
          setUploadProgress("Attaching evidence...");
          data = {
            storageKey,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            bucket,
          };
          await apiAttachEvidence(flowId, taskId, draft.type, data, draft.idempotencyKey);
        }
      }

      setState("success");
      setUploadProgress("");
      
      // Reset draft but with a NEW idempotency key for the next one
      setTimeout(() => {
        setDraft({
          type: typeFromSchema as any,
          textValue: "",
          structuredJsonText: "",
          selectedFile: null,
          idempotencyKey: generateIdempotencyKey(taskId),
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setState("idle");
        onAttached();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
      setUploadProgress("");
    }
  };

  const updateDraft = (updates: Partial<EvidenceDraft>) => {
    setDraft(d => ({ ...d, ...updates }));
    if (state === "error" || state === "success") setState("idle");
  };

  const isSubmitting = state === "getting-url" || state === "uploading" || state === "attaching";

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
            disabled={isSubmitting || state === "success"}
          />
          {schema?.description && (
            <p className="text-[10px] text-muted-foreground italic">{schema.description}</p>
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
            disabled={isSubmitting || state === "success"}
          />
          <p className="text-[10px] text-muted-foreground">
            {schema?.description || "Enter valid JSON object."}
          </p>
        </div>
      )}

      {draft.type === "FILE" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="file-input" className="text-xs">Select File</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                id="file-input"
                type="file"
                onChange={handleFileSelect}
                className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                disabled={isSubmitting || state === "success"}
              />
            </div>
          </div>
          
          {draft.selectedFile && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <File className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{draft.selectedFile.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(draft.selectedFile.size)} • {draft.selectedFile.type || "unknown type"}
                </p>
              </div>
            </div>
          )}
          
          {uploadProgress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {uploadProgress}
            </div>
          )}
          
          {schema?.description && (
            <p className="text-[10px] text-muted-foreground italic">{schema.description}</p>
          )}
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
        disabled={isSubmitting || state === "success"}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {draft.type === "FILE" ? "Uploading..." : "Attaching..."}
          </>
        ) : (
          <>
            {draft.type === "FILE" && <Upload className="mr-2 h-4 w-4" />}
            Attach Evidence
          </>
        )}
      </Button>
    </form>
  );
}
