"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2Icon, SaveIcon, RotateCcwIcon, AlertCircleIcon } from "lucide-react";

interface EvidenceSchemaEditorProps {
  workflowId: string;
  nodeId: string;
  taskId: string;
  isEditable: boolean;
  initialSchema: any | null;
  onSchemaUpdated: () => void;
}

export function EvidenceSchemaEditor({
  workflowId,
  nodeId,
  taskId,
  isEditable,
  initialSchema,
  onSchemaUpdated,
}: EvidenceSchemaEditorProps) {
  const [schemaText, setSchemaText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Initialize and reset
  useEffect(() => {
    const text = initialSchema ? JSON.stringify(initialSchema, null, 2) : "{}";
    setSchemaText(text);
    setError(null);
    setParseError(null);
  }, [initialSchema]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setSchemaText(newText);
    
    // Pre-flight parse check
    try {
      if (newText.trim()) {
        JSON.parse(newText);
      }
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const handleRevert = () => {
    setSchemaText(initialSchema ? JSON.stringify(initialSchema, null, 2) : "{}");
    setParseError(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!isEditable || parseError) return;
    
    setIsSaving(true);
    setError(null);

    try {
      let parsedSchema;
      try {
        parsedSchema = JSON.parse(schemaText);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Invalid JSON");
        setIsSaving(false);
        return;
      }

      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/evidence-schema`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema: parsedSchema }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to save schema");
      }

      onSchemaUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schema");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(initialSchema || {}) !== ( () => {
    try { return JSON.stringify(JSON.parse(schemaText || "{}")); } catch { return ""; }
  })();

  return (
    <div className="space-y-3 mt-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Evidence Schema (JSON)</label>
        {isEditable && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRevert}
              disabled={isSaving || !schemaText}
              className="h-7 text-xs"
            >
              <RotateCcwIcon className="size-3 mr-1" />
              Revert
            </Button>
            <Button
              size="xs"
              onClick={handleSave}
              disabled={isSaving || !!parseError || !schemaText.trim()}
              className="h-7 text-xs"
            >
              {isSaving ? (
                <Loader2Icon className="size-3 animate-spin mr-1" />
              ) : (
                <SaveIcon className="size-3 mr-1" />
              )}
              Save Schema
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <Textarea
          value={schemaText}
          onChange={handleTextChange}
          disabled={!isEditable || isSaving}
          placeholder='{ "type": "object", "properties": { ... } }'
          rows={8}
          className={`font-mono text-xs resize-none ${
            parseError ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
        />
      </div>

      {parseError && (
        <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
          <AlertCircleIcon className="size-3" />
          JSON Error: {parseError}
        </p>
      )}

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {!isEditable && (
        <p className="text-[10px] text-muted-foreground italic">
          Schema is read-only for published workflows.
        </p>
      )}
    </div>
  );
}
