/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DraggableResizablePanel } from "@/components/flowspec/draggable-resizable-panel";
import * as React from "react";

describe("DraggableResizablePanel Overlay Stability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock setPointerCapture which is not in JSDOM
    if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
      Element.prototype.releasePointerCapture = vi.fn();
      Element.prototype.hasPointerCapture = vi.fn(() => true);
    }
    
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 600,
      height: 400,
      top: 100,
      left: 100,
      right: 700,
      bottom: 500,
      x: 100,
      y: 100,
      toJSON: () => {},
    }));
  });

  it("renders with position: fixed", () => {
    render(
      <DraggableResizablePanel 
        workflowId="test-wf" 
        title="Test Panel" 
        isExpanded={true} 
        onExpandedChange={() => {}}
      >
        <div>Content</div>
      </DraggableResizablePanel>
    );

    const panel = screen.getByTestId("config-panel");
    expect(panel.style.position).toBe("fixed");
  });

  it("updates dimensions on manual resize - Right Edge", async () => {
    render(
      <DraggableResizablePanel 
        workflowId="test-wf" 
        title="Test Panel" 
        isExpanded={true} 
        onExpandedChange={() => {}}
      >
        <div>Content</div>
      </DraggableResizablePanel>
    );

    const panel = screen.getByTestId("config-panel");
    const resizerRight = screen.getByTestId("resizer-right");

    // Mock initial state w=600, x=100
    // Resize from right: dx = clientX - startX
    fireEvent.pointerDown(resizerRight, { clientX: 700, clientY: 300, button: 0, pointerId: 1 });
    fireEvent.pointerMove(resizerRight, { clientX: 800, clientY: 300, pointerId: 1 });
    
    expect(panel.style.width).toBe("700px");
    expect(panel.style.height).toBe("400px"); // Height unchanged
  });

  it("updates dimensions on manual resize - Bottom Edge", async () => {
    render(
      <DraggableResizablePanel 
        workflowId="test-wf" 
        title="Test Panel" 
        isExpanded={true} 
        onExpandedChange={() => {}}
      >
        <div>Content</div>
      </DraggableResizablePanel>
    );

    const panel = screen.getByTestId("config-panel");
    const resizerBottom = screen.getByTestId("resizer-bottom");

    // Mock initial state h=400, y=100
    fireEvent.pointerDown(resizerBottom, { clientX: 400, clientY: 500, button: 0, pointerId: 1 });
    fireEvent.pointerMove(resizerBottom, { clientX: 400, clientY: 650, pointerId: 1 });
    
    expect(panel.style.height).toBe("550px");
    expect(panel.style.width).toBe("600px"); // Width unchanged
  });

  it("updates dimensions on manual resize - Corner", async () => {
    render(
      <DraggableResizablePanel 
        workflowId="test-wf" 
        title="Test Panel" 
        isExpanded={true} 
        onExpandedChange={() => {}}
      >
        <div>Content</div>
      </DraggableResizablePanel>
    );

    const panel = screen.getByTestId("config-panel");
    const resizerCorner = screen.getByTestId("resizer-corner");

    fireEvent.pointerDown(resizerCorner, { clientX: 700, clientY: 500, button: 0, pointerId: 1 });
    fireEvent.pointerMove(resizerCorner, { clientX: 800, clientY: 650, pointerId: 1 });
    
    expect(panel.style.width).toBe("700px");
    expect(panel.style.height).toBe("550px");
  });

  it("stops pointer down propagation to avoid canvas interaction", () => {
    const onCanvasMouseDown = vi.fn();
    render(
      <div onPointerDown={onCanvasMouseDown}>
        <DraggableResizablePanel 
          workflowId="test-wf" 
          title="Test Panel" 
          isExpanded={true} 
          onExpandedChange={() => {}}
        >
          <div>Content</div>
        </DraggableResizablePanel>
      </div>
    );

    const panel = screen.getByTestId("config-panel");
    fireEvent.pointerDown(panel, { clientX: 0, clientY: 0, button: 0, pointerId: 1 });
    
    expect(onCanvasMouseDown).not.toHaveBeenCalled();
  });

  it("updates position on drag via state and styles", async () => {
    render(
      <DraggableResizablePanel 
        workflowId="test-wf" 
        title="Test Panel" 
        isExpanded={true} 
        onExpandedChange={() => {}}
      >
        <div>Content</div>
      </DraggableResizablePanel>
    );

    const panel = screen.getByTestId("config-panel");
    const header = screen.getByText("Test Panel").parentElement!;

    // Initial drag start
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
    
    // Move
    fireEvent.pointerMove(header, { clientX: 150, clientY: 150, pointerId: 1 });
    
    // Style should update with left/top
    expect(panel.style.left).toBe("150px");
    expect(panel.style.top).toBe("150px");
  });

  it("persists state to localStorage on pointer up", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <DraggableResizablePanel 
        workflowId="test-wf" 
        title="Test Panel" 
        isExpanded={true} 
        onExpandedChange={() => {}}
      >
        <div>Content</div>
      </DraggableResizablePanel>
    );

    const header = screen.getByText("Test Panel").parentElement!;
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 110, clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(header, { pointerId: 1 });

    expect(setItemSpy).toHaveBeenCalledWith(
      "flowspec:workflow-config-panel:test-wf",
      expect.stringContaining('"v":2') // Verify migration to v2
    );
  });
});
