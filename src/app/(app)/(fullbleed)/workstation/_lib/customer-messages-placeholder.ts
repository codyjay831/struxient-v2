/**
 * PLACEHOLDER — NO REAL MESSAGING SYSTEM EXISTS YET
 * 
 * This file contains static fixtures for the Customer Messages surface.
 * It establishes the UI contract without implementing a bidirectional messaging domain.
 */

export interface CustomerMessagePlaceholder {
  id: string;
  customerName: string;
  jobLabel: string;
  jobId: string;
  messagePreview: string;
  timestamp: string;
  source: "Email" | "Portal" | "SMS";
}

export const CUSTOMER_MESSAGES_PLACEHOLDERS: CustomerMessagePlaceholder[] = [
  {
    id: "msg-001",
    customerName: "Alice Placeholder",
    jobLabel: "Job: solar-abc",
    jobId: "job_solar_abc_123",
    messagePreview: "Hello, I wanted to confirm the installation time for tomorrow morning...",
    timestamp: "10:24 AM",
    source: "Email"
  },
  {
    id: "msg-002",
    customerName: "Bob Static",
    jobLabel: "Job: roof-xyz",
    jobId: "job_roof_xyz_456",
    messagePreview: "Could you please send the updated permit documents for my records?",
    timestamp: "Yesterday",
    source: "Portal"
  },
  {
    id: "msg-003",
    customerName: "Charlie Mock",
    jobLabel: "Job: hvac-789",
    jobId: "job_hvac_789_def",
    messagePreview: "The crew just finished the inspection. Everything looks great!",
    timestamp: "Monday",
    source: "SMS"
  }
];
