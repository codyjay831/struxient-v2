import { useState, useEffect, useCallback } from "react";

export interface LoopbackMetadata {
  label: string;
  color?: string;
}

/**
 * Map of routeKey to metadata.
 * routeKey is expected to be `${sourceNodeId}:${outcomeName}`.
 */
export type LoopbackMetadataMap = Record<string, LoopbackMetadata>;

/**
 * Hook to manage UI-only loopback metadata in localStorage.
 * Keyed by workflowId to keep metadata isolated per workflow.
 *
 * Storage format: struxient_v2_loopback_metadata_{workflowId}
 * 
 * Canon Guardrail:
 * - Metadata is strictly UI-only and never enters the WorkflowSpec.
 * - This hook provides a way to persist labels for the human operator
 *   without affecting engine semantics.
 */
export function useLoopbackMetadata(workflowId: string) {
  const storageKey = `struxient_v2_loopback_metadata_${workflowId}`;

  const [metadata, setMetadata] = useState<LoopbackMetadataMap>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Failed to load loopback metadata from localStorage", error);
      return {};
    }
  });

  // Persist to localStorage whenever metadata changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(metadata));
    }
  }, [metadata, storageKey]);

  /**
   * Updates the label for a specific loopback route.
   * @param routeKey - `${sourceNodeId}:${outcomeName}`
   * @param label - The new display label
   */
  const updateLoopbackLabel = useCallback(
    (routeKey: string, label: string) => {
      setMetadata((prev) => ({
        ...prev,
        [routeKey]: {
          ...prev[routeKey],
          label,
        },
      }));
    },
    []
  );

  /**
   * Clears all metadata for the current workflow.
   */
  const clearMetadata = useCallback(() => {
    setMetadata({});
  }, []);

  return {
    metadata,
    updateLoopbackLabel,
    clearMetadata,
  };
}
