/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";

describe("Detour Visuals and Legend", () => {
  const mockNodes = [
    { id: "n1", name: "Start", isEntry: true, nodeKind: "MAINLINE" as const, position: { x: 0, y: 0 } },
    { id: "n2", name: "Detour Node", isEntry: false, nodeKind: "DETOUR" as const, position: { x: 200, y: 0 } },
    { id: "n3", name: "End", isEntry: false, nodeKind: "MAINLINE" as const, position: { x: 400, y: 0 } }
  ];

  const mockGates = [
    { id: "g1", sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "To Detour" },
    { id: "g2", sourceNodeId: "n2", targetNodeId: "n3", outcomeName: "Resume" }
  ];

  it("renders the canvas legend with detour explanation", () => {
    render(
      <WorkflowCanvas 
        nodes={mockNodes} 
        gates={mockGates} 
      />
    );

    expect(screen.getByText("Mainline")).toBeDefined();
    expect(screen.getByText("Detour (Compensation)")).toBeDefined();
    expect(screen.getAllByText("Detour").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resume").length).toBeGreaterThan(0);
  });

  it("applies dashed styling to detour edges", () => {
    const { container } = render(
      <WorkflowCanvas 
        nodes={mockNodes} 
        gates={mockGates} 
      />
    );

    // Entry into detour (n1 -> n2)
    const entryEdge = container.querySelectorAll('[data-testid="canvas-edge-n1-to-detour-n2"] line')[1];
    expect(entryEdge?.getAttribute("stroke-dasharray")).toBe("5,5");

    // Exit from detour (n2 -> n3)
    const exitEdge = container.querySelectorAll('[data-testid="canvas-edge-n2-resume-n3"] line')[1];
    expect(exitEdge?.getAttribute("stroke-dasharray")).toBe("5,5");
  });

  it("applies solid styling to mainline edges", () => {
    const mainlineNodes = [
      { id: "n1", name: "Start", isEntry: true, nodeKind: "MAINLINE" as const, position: { x: 0, y: 0 } },
      { id: "n3", name: "End", isEntry: false, nodeKind: "MAINLINE" as const, position: { x: 400, y: 0 } }
    ];
    const mainlineGates = [
      { id: "g3", sourceNodeId: "n1", targetNodeId: "n3", outcomeName: "Success" }
    ];

    const { container } = render(
      <WorkflowCanvas 
        nodes={mainlineNodes} 
        gates={mainlineGates} 
      />
    );

    const edge = container.querySelectorAll('[data-testid="canvas-edge-n1-success-n3"] line')[1];
    expect(edge?.getAttribute("stroke-dasharray")).toBe("none");
  });

  it("prioritizes nodeKind over name prefix (Precedence Rule)", () => {
    // nodeKind=MAINLINE + name starts with DETOUR: → should render MAINLINE (solid)
    const contradictingNodes = [
      { id: "n1", name: "Start", isEntry: true, nodeKind: "MAINLINE" as const, position: { x: 0, y: 0 } },
      { id: "n2", name: "DETOUR: Actually Mainline", isEntry: false, nodeKind: "MAINLINE" as const, position: { x: 200, y: 0 } }
    ];
    const gates = [
      { id: "g1", sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "Next" }
    ];

    const { container } = render(
      <WorkflowCanvas 
        nodes={contradictingNodes} 
        gates={gates} 
      />
    );

    const edge = container.querySelectorAll('[data-testid="canvas-edge-n1-next-n2"] line')[1];
    expect(edge?.getAttribute("stroke-dasharray")).toBe("none");
  });

  it("uses name prefix fallback only if nodeKind is missing (Legacy nodes)", () => {
    // nodeKind undefined + name starts with DETOUR: → detour styling applies (dashed)
    const legacyNodes = [
      { id: "n1", name: "Start", isEntry: true, nodeKind: "MAINLINE" as const, position: { x: 0, y: 0 } },
      { id: "n2", name: "DETOUR: Legacy", isEntry: false, position: { x: 200, y: 0 } } as any
    ];
    const gates = [
      { id: "g1", sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "Next" }
    ];

    const { container } = render(
      <WorkflowCanvas 
        nodes={legacyNodes} 
        gates={gates} 
      />
    );

    const edge = container.querySelectorAll('[data-testid="canvas-edge-n1-next-n2"] line')[1];
    expect(edge?.getAttribute("stroke-dasharray")).toBe("5,5");
  });
});
