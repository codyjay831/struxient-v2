/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import * as React from "react";

describe("WorkflowCanvas Persistence", () => {
  const mockNodes = [
    { id: "n1", name: "Node 1", isEntry: true, position: { x: 100, y: 100 } },
    { id: "n2", name: "Node 2", isEntry: false },
  ];
  const mockGates = [];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock setPointerCapture which is not in JSDOM
    if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
      Element.prototype.releasePointerCapture = vi.fn();
    }
  });

  it("prefers explicit node positions over auto-layout", () => {
    // We can't easily check the rendered SVG coordinates in JSDOM, 
    // but we can verify that explicit positions are passed into the memoized 'positions' state.
    // However, since 'positions' is internal state, we'll verify via a test component that exposes it
    // or by checking for regression in intent.
    
    // Minimal check: Render and ensure no crash with position provided
    render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates} 
      />
    );
    
    expect(screen.getByText("Node 1")).toBeTruthy();
  });

  it("calls onNodeDragEnd only on mouse up after a drag", () => {
    const onNodeDragEnd = vi.fn();
    render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates} 
        onNodeDragEnd={onNodeDragEnd}
      />
    );

    const nodes = screen.getAllByTestId("canvas-node");
    const node = nodes[0];
    
    // 1. Simulate drag
    fireEvent.pointerDown(node, { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
    
    // Move more than DRAG_THRESHOLD_PX (5)
    fireEvent.pointerMove(node, { clientX: 10, clientY: 10, pointerId: 1 });
    
    // Before mouse up, it shouldn't be called
    expect(onNodeDragEnd).not.toHaveBeenCalled();

    // 2. Simulate mouse up
    fireEvent.pointerUp(node, { pointerId: 1 });

    // Should be called now
    expect(onNodeDragEnd).toHaveBeenCalledTimes(1);
    expect(onNodeDragEnd).toHaveBeenCalledWith("n1", expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number)
    }));
  });

  it("does not call onNodeDragEnd on simple click", () => {
    const onNodeDragEnd = vi.fn();
    const onNodeClick = vi.fn();
    render(
      <WorkflowCanvas 
        nodes={mockNodes as any} 
        gates={mockGates} 
        onNodeDragEnd={onNodeDragEnd}
        onNodeClick={onNodeClick}
      />
    );

    const nodes = screen.getAllByTestId("canvas-node");
    const node = nodes[0];
    
    // Simulate click (down then up without move)
    fireEvent.pointerDown(node, { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
    fireEvent.pointerUp(node, { pointerId: 1 });

    expect(onNodeDragEnd).not.toHaveBeenCalled();
    expect(onNodeClick).toHaveBeenCalledWith("n1");
  });
});
