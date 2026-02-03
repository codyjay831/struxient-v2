/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WorkflowDetailPage from "@/app/(app)/(fullbleed)/flowspec/[workflowId]/page";
import * as React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ workflowId: "test-workflow-id" }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
  useUser: () => ({ user: { id: "user_123" } }),
}));

// Mock the components that might cause issues in JSDOM
vi.mock("@/components/canvas/workflow-canvas", () => ({
  WorkflowCanvas: () => <div data-testid="workflow-canvas" />,
}));

// Mock the status badge
vi.mock("@/components/flowspec/workflow-status-badge", () => ({
  WorkflowStatusBadge: ({ status }: { status: string }) => <div data-testid="status-badge">{status}</div>,
}));

describe("FlowSpec Builder - Create First Node Affordance", () => {
  const mockWorkflowDraft = {
    id: "test-workflow-id",
    name: "Test Workflow",
    description: "Test Description",
    status: "DRAFT",
    version: 1,
    nodes: [],
    gates: [],
    fanOutRules: [],
  };

  const mockWorkflowPublished = {
    ...mockWorkflowDraft,
    status: "PUBLISHED",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders Add Node button in sidebar header when workflow is in DRAFT status", async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/versions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ workflow: mockWorkflowDraft }),
      });
    });

    render(<WorkflowDetailPage />);

    // Wait for the workflow to load
    await waitFor(() => {
      expect(screen.queryByTestId("nodes-sidebar")).toBeNull();
    });

    // We need to expand the sidebar first since it's collapsed by default
    const toggle = screen.getByTestId("sidebar-toggle");
    toggle.click();

    await waitFor(() => {
      expect(screen.getByTestId("nodes-sidebar")).toBeTruthy();
    });

    // Assert "Add Node" button exists in the sidebar header
    const addNodeButton = screen.getByRole("button", { name: /add node/i });
    expect(addNodeButton).toBeTruthy();
  });

  it("hides Add Node button in sidebar header when workflow is PUBLISHED", async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/versions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ workflow: mockWorkflowPublished }),
      });
    });

    render(<WorkflowDetailPage />);

    // Wait for the workflow to load
    await waitFor(() => {
      expect(screen.queryByTestId("sidebar-toggle")).toBeTruthy();
    });

    // Expand sidebar
    const toggle = screen.getByTestId("sidebar-toggle");
    toggle.click();

    await waitFor(() => {
      expect(screen.getByTestId("nodes-sidebar")).toBeTruthy();
    });

    // Assert "Add Node" button DOES NOT exist
    const addNodeButton = screen.queryByRole("button", { name: /add node/i });
    expect(addNodeButton).toBeNull();
  });
});
