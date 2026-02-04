import { describe, it, expect } from "vitest";
import { 
  computeNodeDepths, 
  detectEdgeType, 
  computeDeterministicSpine,
  getPerimeterPoint,
  Node,
  Gate 
} from "@/lib/canvas/layout";

describe("Canvas Layout Utilities", () => {
  const nodes: Node[] = [
    { id: "n1", name: "Start", isEntry: true },
    { id: "n2", name: "Process A", isEntry: false },
    { id: "n3", name: "Process B", isEntry: false },
    { id: "n4", name: "End", isEntry: false },
    { id: "orphan", name: "Orphan", isEntry: false },
  ];

  const gates: Gate[] = [
    { id: "g1", sourceNodeId: "n1", targetNodeId: "n2", outcomeName: "to A" },
    { id: "g2", sourceNodeId: "n2", targetNodeId: "n3", outcomeName: "to B" },
    { id: "g3", sourceNodeId: "n3", targetNodeId: "n4", outcomeName: "to End" },
    { id: "g4", sourceNodeId: "n3", targetNodeId: "n2", outcomeName: "loop back" }, // Loopback
    { id: "g5", sourceNodeId: "n2", targetNodeId: "n2", outcomeName: "self" },      // Self-loop
  ];

  describe("computeNodeDepths", () => {
    it("assigns correct depths via BFS", () => {
      const depths = computeNodeDepths(nodes, gates);
      expect(depths["n1"]).toBe(0);
      expect(depths["n2"]).toBe(1);
      expect(depths["n3"]).toBe(2);
      expect(depths["n4"]).toBe(3);
    });

    it("handles unreachable nodes with Infinity", () => {
      const depths = computeNodeDepths(nodes, gates);
      expect(depths["orphan"]).toBe(Infinity);
    });
  });

  describe("detectEdgeType", () => {
    it("detects forward edges", () => {
      const depths = computeNodeDepths(nodes, gates);
      expect(detectEdgeType("n1", "n2", depths)).toBe("forward");
      expect(detectEdgeType("n2", "n3", depths)).toBe("forward");
    });

    it("detects loopbacks even when not on spine", () => {
      const depths = computeNodeDepths(nodes, gates);
      // n3 (depth 2) -> n2 (depth 1)
      expect(detectEdgeType("n3", "n2", depths)).toBe("loopback");
    });

    it("detects self-loops", () => {
      const depths = computeNodeDepths(nodes, gates);
      expect(detectEdgeType("n2", "n2", depths)).toBe("self");
    });

    it("handles terminal nodes as forward", () => {
      const depths = computeNodeDepths(nodes, gates);
      expect(detectEdgeType("n4", null, depths)).toBe("forward");
    });

    it("does not misclassify unreachable nodes as loopbacks", () => {
      const depths = computeNodeDepths(nodes, gates);
      // n1 (depth 0) -> orphan (depth Infinity)
      expect(detectEdgeType("n1", "orphan", depths)).toBe("forward");
    });
  });

  describe("computeDeterministicSpine", () => {
    it("identifies the longest path in BFS tree", () => {
      const spine = computeDeterministicSpine(nodes, gates);
      expect(spine).toEqual(["n1", "n2", "n3", "n4"]);
    });

    it("is deterministic over multiple runs", () => {
      for (let i = 0; i < 100; i++) {
        const spine = computeDeterministicSpine(nodes, gates);
        expect(spine).toEqual(["n1", "n2", "n3", "n4"]);
      }
    });

    it("tie-breaks using alphabetical node ID", () => {
      const branchingNodes: Node[] = [
        { id: "a", name: "A", isEntry: true },
        { id: "b", name: "B", isEntry: false },
        { id: "c", name: "C", isEntry: false },
      ];
      const branchingGates: Gate[] = [
        { id: "g1", sourceNodeId: "a", targetNodeId: "b", outcomeName: "to b" },
        { id: "g2", sourceNodeId: "a", targetNodeId: "c", outcomeName: "to c" },
      ];
      // Both a->b and a->c have length 2. 
      // Alphabetical tie-break should pick "a,b"
      const spine = computeDeterministicSpine(branchingNodes, branchingGates);
      expect(spine).toEqual(["a", "b"]);
    });
  });

  describe("getPerimeterPoint", () => {
    it("returns correct point on right edge", () => {
      // Node at 0,0, size 100x100. Center is 50,50.
      // Line from (200, 50) towards center.
      const p = getPerimeterPoint(200, 50, 0, 0, 100, 100);
      expect(p.x).toBe(100);
      expect(p.y).toBe(50);
    });

    it("returns correct point on top edge", () => {
      const p = getPerimeterPoint(50, -100, 0, 0, 100, 100);
      expect(p.x).toBe(50);
      expect(p.y).toBe(0);
    });

    it("respects padding", () => {
      const p = getPerimeterPoint(200, 50, 0, 0, 100, 100, 10);
      expect(p.x).toBe(110);
      expect(p.y).toBe(50);
    });

    it("is deterministic", () => {
      for (let i = 0; i < 100; i++) {
        const p = getPerimeterPoint(150, 150, 0, 0, 100, 100);
        expect(p.x).toBe(100);
        expect(p.y).toBe(100);
      }
    });
  });
});
