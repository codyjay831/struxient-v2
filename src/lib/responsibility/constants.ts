/**
 * Responsibility Slot Keys
 * 
 * Canon: Responsibility Layer Checklist v1 §GR-3
 * Purpose: Pre-defined keys for accountability slots. 
 * These drive notifications and reporting, NOT execution gating.
 */
export const SLOT_KEYS = {
  PM: "PM", // Project Manager
  SALES_LEAD: "SALES_LEAD",
  PLAN_DRAWER: "PLAN_DRAWER",
  PERMIT_PULLER: "PERMIT_PULLER",
  CREW_LEAD: "CREW_LEAD",
  SUB_CONTACT: "SUB_CONTACT",
} as const;

export type SlotKey = keyof typeof SLOT_KEYS | (string & {});

/**
 * Assignee Types supported in v1
 */
export enum AssigneeType {
  PERSON = "PERSON",
  EXTERNAL = "EXTERNAL",
}
