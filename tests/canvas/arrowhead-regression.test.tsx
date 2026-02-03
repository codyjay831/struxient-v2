/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import * as React from "react";

describe("WorkflowCanvas Arrowhead Regression", () => {
  const mockNodes = [
    { id: "node-a", name: "Node A", isEntry: true, position: { x: 100, y: 100 } },
    { id: "node-b", name: "Node B", isEntry: false, position: { x: 400, y: 100 } },
  ];

  const mockGates = [
    { 
      id: "gate-forward", 
      sourceNodeId: "node-a", 
      targetNodeId: "node-b", 
      outcomeName: "Go to B" 
    },
    { 
      id: "gate-loopback", 
      sourceNodeId: "node-b", 
      targetNodeId: "node-a", 
      outcomeName: "Back to A" 
    }
  ];

  beforeEach(() => {
    // No specific mocks needed for this test as we are checking DOM structure
  });

  it("Test 1: Marker definitions exist inside <defs> in the root <svg>", () => {
    const { container } = render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates as any} 
      />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();

    const defs = svg?.querySelector("defs");
    expect(defs).toBeTruthy();

    const marker = defs?.querySelector('marker[id="arrowhead-special"]');
    expect(marker).toBeTruthy();

    const polygon = marker?.querySelector("polygon");
    expect(polygon?.getAttribute("fill")).toBe("currentColor");
    expect(polygon?.getAttribute("class")).toContain("text-primary");

    const selectedMarker = defs?.querySelector('marker[id="arrowhead-special-selected"]');
    expect(selectedMarker).toBeTruthy();

    const selectedPolygon = selectedMarker?.querySelector("polygon");
    expect(selectedPolygon?.getAttribute("fill")).toBe("currentColor");
    expect(selectedPolygon?.getAttribute("class")).toContain("text-primary");
  });

  it("Test 2: Loopback edge has marker-end attribute", () => {
    const { container } = render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates as any} 
      />
    );

    // Find the loopback edge. In our mock data:
    // node-b -> node-a is loopback because depth(a)=0 and depth(b)=1.
    // The testId for node-b -> node-a with "Back to A" outcome:
    // canvas-edge-node-b-back-to-a-node-a
    const loopbackGroup = container.querySelector('[data-testid="canvas-edge-node-b-back-to-a-node-a"]');
    expect(loopbackGroup).toBeTruthy();

    // The visual path is the second path in the group (first is hit area)
    const paths = loopbackGroup?.querySelectorAll("path");
    expect(paths?.length).toBeGreaterThanOrEqual(2);
    
    const visualPath = paths?.[1];
    expect(visualPath?.getAttribute("marker-end")).toBe("url(#arrowhead-special)");
  });

  it("Test 3: Forward edge has NO marker-end attribute", () => {
    const { container } = render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates as any} 
      />
    );

    // Find the forward edge. node-a -> node-b
    // canvas-edge-node-a-go-to-b-node-b
    const forwardGroup = container.querySelector('[data-testid="canvas-edge-node-a-go-to-b-node-b"]');
    expect(forwardGroup).toBeTruthy();

    // Forward edge uses <line> for visual element in current implementation
    const visualLine = forwardGroup?.querySelector("line:not([stroke='transparent'])");
    expect(visualLine).toBeTruthy();
    expect(visualLine?.getAttribute("marker-end")).toBeFalsy();
  });

  it("Test 4: Loopback edge end point is on or slightly outside the destination node boundary", () => {
    const { container } = render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates as any} 
      />
    );

    // Node A is at (100, 100) with width 140, height 60.
    // Loopback edge B -> A.
    const loopbackGroup = container.querySelector('[data-testid="canvas-edge-node-b-back-to-a-node-a"]');
    const visualPath = loopbackGroup?.querySelectorAll("path")[1];
    const d = visualPath?.getAttribute("d") || "";
    
    // Path format: M startX startY Q midX midY endX endY
    const parts = d.split(/[ ,]+/);
    const endX = parseFloat(parts[parts.length - 2]);
    const endY = parseFloat(parts[parts.length - 1]);

    // Node A bounds: x:[100, 240], y:[100, 160]
    // The loopback dip is below, so it should hit the bottom region.
    
    // Assert end point is NOT inside the original rectangle bounds
    const isInsideNode = endX > 100 && endX < 240 && endY > 100 && endY < 160;
    expect(isInsideNode).toBe(false);

    // Assert it is anchored to the perimeter (within padding distance)
    // Node A center is (170, 130). 
    // Boundary is x=100, x=240, y=100, y=160.
    // With 6px padding, boundary is x=94, x=246, y=94, y=166.
    const onBoundary = Math.abs(endX - 94) < 1 || Math.abs(endX - 246) < 1 || 
                       Math.abs(endY - 94) < 1 || Math.abs(endY - 166) < 1;
    expect(onBoundary).toBe(true);
  });
});
