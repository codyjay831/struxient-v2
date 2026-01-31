"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2Icon,
  SaveIcon,
  FileIcon,
  TypeIcon,
  BracesIcon,
  AlertCircleIcon,
  InfoIcon,
  AlertTriangleIcon,
} from "lucide-react";
import type {
  EvidenceSchema,
  EvidenceSchemaType,
  EvidenceFileSchema,
  EvidenceTextSchema,
  EvidenceStructuredSchema,
} from "@/lib/flowspec/evidence/types";

// =============================================================================
// TYPES
// =============================================================================

interface EvidenceSchemaEditorProps {
  workflowId: string;
  nodeId: string;
  taskId: string;
  isEditable: boolean;
  initialSchema: EvidenceSchema | null;
  onSchemaUpdated: () => void;
}

/**
 * Editor modes:
 * - "new": No schema exists yet, user must choose a type
 * - "form": Schema has recognized type, show form inputs
 * - "fallback": Schema has unknown/advanced type, show read-only JSON
 */
type EditorState =
  | { mode: "new" }
  | { mode: "form"; type: "file"; mimeTypes: string; maxSize: string; description: string; originalSchema: Record<string, unknown> }
  | { mode: "form"; type: "text"; minLength: string; maxLength: string; description: string; originalSchema: Record<string, unknown> }
  | { mode: "form"; type: "structured"; jsonSchema: string; description: string; originalSchema: Record<string, unknown> }
  | { mode: "fallback"; rawJson: string; originalSchema: Record<string, unknown> };

// =============================================================================
// HELPERS
// =============================================================================

const EVIDENCE_TYPES: { value: EvidenceSchemaType; label: string; icon: React.ReactNode }[] = [
  { value: "file", label: "File", icon: <FileIcon className="size-3" /> },
  { value: "text", label: "Text", icon: <TypeIcon className="size-3" /> },
  { value: "structured", label: "Structured", icon: <BracesIcon className="size-3" /> },
];

function isValidEvidenceType(type: unknown): type is EvidenceSchemaType {
  return type === "file" || type === "text" || type === "structured";
}

/**
 * Parse initial schema into editor state.
 * - null/undefined → "new" mode
 * - Unknown type → "fallback" mode (preserves JSON exactly)
 * - Recognized type → "form" mode (keeps originalSchema for round-trip)
 */
function parseInitialSchema(schema: EvidenceSchema | null): EditorState {
  if (!schema || typeof schema !== "object") {
    return { mode: "new" };
  }

   const schemaObj = schema as unknown as Record<string, unknown>;

  // Check if type exists and is recognized
  if (!("type" in schemaObj) || !isValidEvidenceType(schemaObj.type)) {
    // Unknown/missing type → fallback mode (read-only JSON display)
    return {
      mode: "fallback",
      rawJson: JSON.stringify(schema, null, 2),
      originalSchema: schemaObj,
    };
  }

  switch (schemaObj.type) {
    case "file": {
      const s = schema as EvidenceFileSchema;
      return {
        mode: "form",
        type: "file",
        mimeTypes: s.mimeTypes?.join(", ") ?? "",
        maxSize: s.maxSize !== undefined ? s.maxSize.toString() : "",
        description: s.description ?? "",
        originalSchema: schemaObj,
      };
    }
    case "text": {
      const s = schema as EvidenceTextSchema;
      return {
        mode: "form",
        type: "text",
        minLength: s.minLength !== undefined ? s.minLength.toString() : "",
        maxLength: s.maxLength !== undefined ? s.maxLength.toString() : "",
        description: s.description ?? "",
        originalSchema: schemaObj,
      };
    }
    case "structured": {
      const s = schema as EvidenceStructuredSchema;
      return {
        mode: "form",
        type: "structured",
        jsonSchema: s.jsonSchema ? JSON.stringify(s.jsonSchema, null, 2) : "",
        description: s.description ?? "",
        originalSchema: schemaObj,
      };
    }
  }
}

/**
 * Build schema from editor state for saving.
 * - Preserves unknown keys from originalSchema
 * - Includes numeric fields if value is parseable (including zero)
 * - Omits fields if value is empty string
 */
function buildSchemaFromState(state: EditorState): Record<string, unknown> | null {
  if (state.mode === "new") return null;
  if (state.mode === "fallback") return null; // Fallback is read-only, no save

  // Start with unknown keys from original schema
  const unknownKeys: Record<string, unknown> = {};
  const knownKeys = new Set(["type", "mimeTypes", "maxSize", "minLength", "maxLength", "description", "jsonSchema"]);
  for (const [key, value] of Object.entries(state.originalSchema)) {
    if (!knownKeys.has(key)) {
      unknownKeys[key] = value;
    }
  }

  switch (state.type) {
    case "file": {
      const schema: Record<string, unknown> = { ...unknownKeys, type: "file" };
      const mimeTypes = state.mimeTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (mimeTypes.length > 0) schema.mimeTypes = mimeTypes;
      const maxSize = parseInt(state.maxSize, 10);
      // Include if parseable (including zero)
      if (state.maxSize !== "" && !isNaN(maxSize)) schema.maxSize = maxSize;
      if (state.description.trim()) schema.description = state.description.trim();
      return schema;
    }
    case "text": {
      const schema: Record<string, unknown> = { ...unknownKeys, type: "text" };
      const minLength = parseInt(state.minLength, 10);
      // Include if parseable (including zero)
      if (state.minLength !== "" && !isNaN(minLength)) schema.minLength = minLength;
      const maxLength = parseInt(state.maxLength, 10);
      // Include if parseable (including zero)
      if (state.maxLength !== "" && !isNaN(maxLength)) schema.maxLength = maxLength;
      if (state.description.trim()) schema.description = state.description.trim();
      return schema;
    }
    case "structured": {
      const schema: Record<string, unknown> = { ...unknownKeys, type: "structured" };
      if (state.jsonSchema.trim()) {
        try {
          schema.jsonSchema = JSON.parse(state.jsonSchema);
        } catch {
          // Invalid JSON - will be caught by validation
        }
      }
      if (state.description.trim()) schema.description = state.description.trim();
      return schema;
    }
  }
}

function getValidationError(state: EditorState): string | null {
  // Fallback mode is read-only, no validation needed
  if (state.mode === "fallback") {
    return null;
  }

  // INV-025: Evidence schema must have a valid type
  if (state.mode === "new") {
    return "Select an evidence type (INV-025)";
  }

  if (state.type === "file") {
    const maxSize = parseInt(state.maxSize, 10);
    // Allow zero; reject only negative or non-numeric when field has value
    if (state.maxSize && (isNaN(maxSize) || maxSize < 0)) {
      return "Max size must be zero or positive";
    }
  }

  if (state.type === "text") {
    const minLength = parseInt(state.minLength, 10);
    const maxLength = parseInt(state.maxLength, 10);
    if (state.minLength && (isNaN(minLength) || minLength < 0)) {
      return "Min length must be zero or positive";
    }
    // Allow zero for maxLength
    if (state.maxLength && (isNaN(maxLength) || maxLength < 0)) {
      return "Max length must be zero or positive";
    }
    if (!isNaN(minLength) && !isNaN(maxLength) && minLength > maxLength) {
      return "Min length cannot exceed max length";
    }
  }

  if (state.type === "structured" && state.jsonSchema.trim()) {
    try {
      JSON.parse(state.jsonSchema);
    } catch {
      return "Invalid JSON Schema syntax";
    }
  }

  return null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EvidenceSchemaEditor({
  workflowId,
  nodeId,
  taskId,
  isEditable,
  initialSchema,
  onSchemaUpdated,
}: EvidenceSchemaEditorProps) {
  const [state, setState] = useState<EditorState>(() => parseInitialSchema(initialSchema));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when initialSchema changes
  useEffect(() => {
    setState(parseInitialSchema(initialSchema));
    setError(null);
  }, [initialSchema]);

  const validationError = getValidationError(state);

  const hasChanges = useCallback(() => {
    const currentSchema = buildSchemaFromState(state);
    if (currentSchema === null && initialSchema === null) return false;
    return JSON.stringify(currentSchema) !== JSON.stringify(initialSchema);
  }, [state, initialSchema]);

  const handleTypeChange = (newType: EvidenceSchemaType) => {
    if (!isEditable) return;

    // Create fresh schema with empty originalSchema (new type = no unknown keys to preserve)
    const emptyOriginal: Record<string, unknown> = {};
    switch (newType) {
      case "file":
        setState({ mode: "form", type: "file", mimeTypes: "", maxSize: "", description: "", originalSchema: emptyOriginal });
        break;
      case "text":
        setState({ mode: "form", type: "text", minLength: "", maxLength: "", description: "", originalSchema: emptyOriginal });
        break;
      case "structured":
        setState({ mode: "form", type: "structured", jsonSchema: "", description: "", originalSchema: emptyOriginal });
        break;
    }
  };

  const handleSave = async () => {
    if (!isEditable || validationError) return;
    if (state.mode === "fallback") return; // Fallback is read-only

    const schema = buildSchemaFromState(state);
    if (!schema) {
      setError("Select an evidence type before saving");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/flowspec/workflows/${workflowId}/nodes/${nodeId}/tasks/${taskId}/evidence-schema`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema }),
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

  // Determine if we can show the save button
  const canSave = state.mode === "form" && isEditable;

  // Determine current type for type selector highlighting
  const currentType = state.mode === "form" ? state.type : null;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-3 mt-4 border-t pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Evidence Schema</label>
        {canSave && (
          <Button
            size="xs"
            onClick={handleSave}
            disabled={isSaving || !!validationError || !hasChanges()}
            className="h-7 text-xs"
          >
            {isSaving ? (
              <Loader2Icon className="size-3 animate-spin mr-1" />
            ) : (
              <SaveIcon className="size-3 mr-1" />
            )}
            Save Schema
          </Button>
        )}
      </div>

      {/* Fallback Mode: Read-only JSON display for unknown/advanced schemas */}
      {state.mode === "fallback" && (
        <FallbackSchemaViewer rawJson={state.rawJson} />
      )}

      {/* Normal Mode: Type selector and form editors */}
      {state.mode !== "fallback" && (
        <>
          {/* Type Selector */}
          <div className="flex gap-1">
            {EVIDENCE_TYPES.map(({ value, label, icon }) => (
              <Button
                key={value}
                variant={currentType === value ? "default" : "outline"}
                size="xs"
                onClick={() => handleTypeChange(value)}
                disabled={!isEditable || isSaving || (value === "structured" && currentType !== "structured")}
                className="h-7 text-xs flex-1"
              >
                {icon}
                <span className="ml-1">{label}</span>
              </Button>
            ))}
          </div>

          {/* Info text for new schemas */}
          {state.mode === "new" && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <InfoIcon className="size-3" />
              Structured evidence requires developer capability and is read-only in this version.
            </p>
          )}

          {/* Type-specific editors */}
          {state.mode === "form" && state.type === "file" && (
            <FileSchemaEditor
              state={state}
              onChange={setState}
              disabled={!isEditable || isSaving}
            />
          )}

          {state.mode === "form" && state.type === "text" && (
            <TextSchemaEditor
              state={state}
              onChange={setState}
              disabled={!isEditable || isSaving}
            />
          )}

          {state.mode === "form" && state.type === "structured" && (
            <StructuredSchemaViewer
              state={state}
              isEditable={false} // v1: Structured is read-only for all users
            />
          )}
        </>
      )}

      {/* Validation Error */}
      {validationError && (
        <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
          <AlertCircleIcon className="size-3" />
          {validationError}
        </p>
      )}

      {/* API Error */}
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Read-only notice */}
      {!isEditable && state.mode !== "fallback" && (
        <p className="text-[10px] text-muted-foreground italic">
          Schema is read-only for published workflows.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// FALLBACK SCHEMA VIEWER (READ-ONLY for unknown/advanced schemas)
// =============================================================================

function FallbackSchemaViewer({ rawJson }: { rawJson: string }) {
  return (
    <div className="space-y-3 p-3 rounded-md border border-amber-500/50 bg-amber-500/5">
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangleIcon className="size-3" />
        <span>This schema uses an advanced or custom format and cannot be edited with the form editor.</span>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Schema (read-only)</label>
        <Textarea
          value={rawJson}
          readOnly
          disabled
          rows={8}
          className="font-mono text-xs resize-none bg-muted"
        />
      </div>
    </div>
  );
}

// =============================================================================
// FILE SCHEMA EDITOR
// =============================================================================

type FileEditorState = Extract<EditorState, { mode: "form"; type: "file" }>;

function FileSchemaEditor({
  state,
  onChange,
  disabled,
}: {
  state: FileEditorState;
  onChange: (state: EditorState) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 p-3 rounded-md border bg-muted/30">
      {/* MIME Types */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Allowed MIME Types</label>
        <Input
          value={state.mimeTypes}
          onChange={(e) => onChange({ ...state, mimeTypes: e.target.value })}
          disabled={disabled}
          placeholder="image/jpeg, image/png, application/pdf"
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Comma-separated list. Leave empty to allow any file type.
        </p>
      </div>

      {/* Max Size */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Max File Size (bytes)</label>
        <Input
          type="number"
          value={state.maxSize}
          onChange={(e) => onChange({ ...state, maxSize: e.target.value })}
          disabled={disabled}
          placeholder="10485760"
          className="h-8 text-xs"
          min={0}
        />
        <p className="text-[10px] text-muted-foreground">
          Leave empty for no size limit. 10485760 = 10MB.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Description</label>
        <Input
          value={state.description}
          onChange={(e) => onChange({ ...state, description: e.target.value })}
          disabled={disabled}
          placeholder="Upload photo documentation"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// =============================================================================
// TEXT SCHEMA EDITOR
// =============================================================================

type TextEditorState = Extract<EditorState, { mode: "form"; type: "text" }>;

function TextSchemaEditor({
  state,
  onChange,
  disabled,
}: {
  state: TextEditorState;
  onChange: (state: EditorState) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 p-3 rounded-md border bg-muted/30">
      {/* Min/Max Length Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Min Length</label>
          <Input
            type="number"
            value={state.minLength}
            onChange={(e) => onChange({ ...state, minLength: e.target.value })}
            disabled={disabled}
            placeholder="0"
            className="h-8 text-xs"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Max Length</label>
          <Input
            type="number"
            value={state.maxLength}
            onChange={(e) => onChange({ ...state, maxLength: e.target.value })}
            disabled={disabled}
            placeholder="500"
            className="h-8 text-xs"
            min={0}
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Leave empty for no length constraints.
      </p>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Description</label>
        <Input
          value={state.description}
          onChange={(e) => onChange({ ...state, description: e.target.value })}
          disabled={disabled}
          placeholder="Explain the reason for this decision"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// =============================================================================
// STRUCTURED SCHEMA VIEWER (READ-ONLY in v1)
// =============================================================================

type StructuredEditorState = Extract<EditorState, { mode: "form"; type: "structured" }>;

function StructuredSchemaViewer({
  state,
  isEditable,
}: {
  state: StructuredEditorState;
  isEditable: boolean;
}) {
  return (
    <div className="space-y-3 p-3 rounded-md border bg-muted/30">
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <InfoIcon className="size-3" />
        <span>Structured evidence requires JSON Schema configuration (developer only)</span>
      </div>

      {/* Description (read-only) */}
      {state.description && (
        <div className="space-y-1">
          <label className="text-xs font-medium">Description</label>
          <p className="text-xs text-muted-foreground">{state.description}</p>
        </div>
      )}

      {/* JSON Schema (read-only) */}
      {state.jsonSchema && (
        <div className="space-y-1">
          <label className="text-xs font-medium">JSON Schema</label>
          <Textarea
            value={state.jsonSchema}
            readOnly
            disabled={!isEditable}
            rows={6}
            className="font-mono text-xs resize-none bg-muted"
          />
        </div>
      )}

      {!state.jsonSchema && !state.description && (
        <p className="text-xs text-muted-foreground italic">
          No structured schema configured.
        </p>
      )}
    </div>
  );
}
