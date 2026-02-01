import { describe, it, expect } from "vitest";
import { getWorkflowLoopbacks } from "../../../src/lib/builder/utils/loopback-detection";

describe("getWorkflowLoopbacks", () => {
  it("detects no loopbacks in a linear graph", () => {
    const workflow = {
      nodes: [
        { id: "n1", isEntry: true },
        { id: "n2", isEntry: false },
        { id: "n3", isEntry: false },
      ],
      gates: [
        { sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "next" },
        { sourceNodeId: "n2", targetNodeId: "n3", outcomeName: "next" },
      ],
    };

    const loopbacks = getWorkflowLoopbacks(workflow);
    expect(loopbacks).toHaveLength(0);
  });

  it("detects a simple loopback (targetDepth < sourceDepth)", () => {
    const workflow = {
      nodes: [
        { id: "n1", isEntry: true },
        { id: "n2", isEntry: false },
        { id: "n3", isEntry: false },
      ],
      gates: [
        { sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "next" },
        { sourceNodeId: "n2", targetNodeId: "n3", outcomeName: "next" },
        { sourceNodeId: "n3", targetNodeId: "n1", outcomeName: "retry" }, // Loopback
      ],
    };

    const loopbacks = getWorkflowLoopbacks(workflow);
    expect(loopbacks).toHaveLength(1);
    expect(loopbacks[0]).toMatchObject({
      sourceNodeId: "n3",
      targetNodeId: "n1",
      outcomeName: "retry",
      topologicalDelta: -2,
    });
  });

  it("detects a self-loop (sourceNodeId === targetNodeId)", () => {
    const workflow = {
      nodes: [
        { id: "n1", isEntry: true },
        { id: "n2", isEntry: false },
      ],
      gates: [
        { sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "next" },
        { sourceNodeId: "n2", targetNodeId: "n2", outcomeName: "retry" }, // Self-loop
      ],
    };

    const loopbacks = getWorkflowLoopbacks(workflow);
    expect(loopbacks).toHaveLength(1);
    expect(loopbacks[0]).toMatchObject({
      sourceNodeId: "n2",
      targetNodeId: "n2",
      outcomeName: "retry",
      topologicalDelta: 0,
    });
  });

  it("handles complex fan-in/fan-out and strictly backward logic", () => {
    const workflow = {
      nodes: [
        { id: "n1", isEntry: true },
        { id: "n2", isEntry: false },
        { id: "n3", isEntry: false },
        { id: "n4", isEntry: false },
      ],
      gates: [
        { sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "a" },
        { sourceNodeId: "n1", targetNodeId: "n3", outcomeName: "b" },
        { sourceNodeId: "n2", targetNodeId: "n4", outcomeName: "c" },
        { sourceNodeId: "n3", targetNodeId: "n4", outcomeName: "d" },
        { sourceNodeId: "n4", targetNodeId: "n2", outcomeName: "loop" }, // targetDepth (1) < sourceDepth (2)
      ],
    };

    const loopbacks = getWorkflowLoopbacks(workflow);
    expect(loopbacks).toHaveLength(1);
    expect(loopbacks[0].sourceNodeId).toBe("n4");
    expect(loopbacks[0].targetNodeId).toBe("n2");
  });

  it("does not classify same-depth forward edges as loopbacks", () => {
    // In some layouts, nodes might have the same shortest-path depth
    // targetDepth (1) === sourceDepth (1)
    const workflow = {
      nodes: [
        { id: "entry", isEntry: true },
        { id: "n1", isEntry: false },
        { id: "n2", isEntry: false },
      ],
      gates: [
        { sourceNodeId: "entry", targetNodeId: "n1", outcomeName: "go_n1" },
        { sourceNodeId: "entry", targetNodeId: "n2", outcomeName: "go_n2" },
        { sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "cross" }, // Both depth 1
      ],
    };

    const loopbacks = getWorkflowLoopbacks(workflow);
    expect(loopbacks).toHaveLength(0); // Should be 0 because targetDepth is NOT < sourceDepth
  });
});
