import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { 
  computeNodeDepths, 
  detectEdgeType, 
  computeDeterministicSpine 
} from "@/lib/canvas/layout";

// Note: We are testing the pure logic and DOM presence, not full React lifecycle here
// to stay within Phase 1 scope and avoid heavy testing library setup if not already present.

describe("Canvas Orientation Contract (v1.1)", () => {
  const mockNodes = [
    { id: "n1", name: "Entry", isEntry: true },
    { id: "n2", name: "Process", isEntry: false },
    { id: "n3", name: "End", isEntry: false },
  ];
  const mockGates = [
    { id: "g1", sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "ok" },
    { id: "g2", sourceNodeId: "n2", targetNodeId: "n3", outcomeName: "done" },
    { id: "g3", sourceNodeId: "n2", targetNodeId: "n1", outcomeName: "back" }, // Loopback
  ];

  it("identifies loopbacks correctly via BFS depth", () => {
    const depths = computeNodeDepths(mockNodes, mockGates);
    expect(depths["n1"]).toBe(0);
    expect(depths["n2"]).toBe(1);
    
    // n2 (depth 1) -> n1 (depth 0) is a loopback
    expect(detectEdgeType("n2", "n1", depths)).toBe("loopback");
  });

  it("computes deterministic spine based on topology length", () => {
    const spine = computeDeterministicSpine(mockNodes, mockGates);
    expect(spine).toEqual(["n1", "n2", "n3"]);
  });

  it("tie-breaks spine deterministically via alphabetical ID", () => {
    const nodes = [
      { id: "a", name: "A", isEntry: true },
      { id: "b", name: "B", isEntry: false },
      { id: "c", name: "C", isEntry: false },
    ];
    const gates = [
      { id: "g1", sourceNodeId: "a", targetNodeId: "b", outcomeName: "b" },
      { id: "g2", sourceNodeId: "a", targetNodeId: "c", outcomeName: "c" },
    ];
    const spine = computeDeterministicSpine(nodes, gates);
    expect(spine).toEqual(["a", "b"]); // 'b' comes before 'c'
  });
});
