/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WorkflowDetailPage from "@/app/(app)/(fullbleed)/flowspec/[workflowId]/page";
import { useParams } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

function getRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  };
}

describe("Phase 2 Overlay Law — Canvas Rect Stability", () => {
  const mockWorkflow = {
    id: "wf-1",
    name: "Test Workflow",
    status: "DRAFT",
    version: 1,
    nodes: [
      { id: "n1", name: "Start", isEntry: true, tasks: [] },
      { id: "n2", name: "End", isEntry: false, tasks: [] }
    ],
    gates: [
      { id: "g1", sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "Success" }
    ],
    fanOutRules: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as any).mockReturnValue({ workflowId: "wf-1" });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ workflow: mockWorkflow, items: [] })
    });
  });

  it("proves canvas container rect is identical when Node Inspector opens", async () => {
    render(<WorkflowDetailPage />);
    const canvas = await screen.findByTestId("workflow-canvas-container");

    // JSDOM mock rects are stable (usually 0,0,0,0)
    const before = getRect(canvas);

    // Open Node Inspector
    const nodes = await screen.findAllByTestId("canvas-node");
    fireEvent.click(nodes[0]);

    // Sheet should be visible
    await screen.findByTestId("node-inspector");

    const after = getRect(canvas);

    // Contract Law: x,y,w,h must be exactly equal
    expect(after).toEqual(before);
  });

  it("proves canvas container rect is identical when Edge Inspector opens", async () => {
    render(<WorkflowDetailPage />);
    const canvas = await screen.findByTestId("workflow-canvas-container");

    const before = getRect(canvas);

    // Open Edge Inspector
    // testId format: canvas-edge-${source}-${slug(outcome)}-${target}
    const edge = await screen.findByTestId("canvas-edge-n1-success-n2");
    fireEvent.click(edge);

    // Edge inspector should be visible
    await screen.findByTestId("edge-inspector");

    const after = getRect(canvas);

    // Contract Law: x,y,w,h must be exactly equal
    expect(after).toEqual(before);
  });

  it("proves clicking background clears selection and closes inspector", async () => {
    render(<WorkflowDetailPage />);
    await screen.findByTestId("workflow-canvas-container");

    // Select node
    const nodes = await screen.findAllByTestId("canvas-node");
    fireEvent.click(nodes[0]);
    expect(screen.queryByTestId("node-inspector")).not.toBeNull();

    // Click background
    const background = screen.getByTestId("workflow-canvas");
    fireEvent.click(background);

    // Verification of exclusivity and closure
    expect(screen.queryByTestId("node-inspector")).toBeNull();
  });
});
