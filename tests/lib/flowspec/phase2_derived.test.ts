import { describe, it, expect } from "vitest";
import { 
  computeValidityMap, 
  computeNodeComplete, 
  computeTaskActionable,
  computeBlockedNodes,
  computeFlowComplete
} from "@/lib/flowspec/derived";
import { CompletionRule, ValidityState, DetourStatus, DetourType } from "@prisma/client";

describe("Phase 2: Derived State Logic", () => {
  const mockNode: any = {
    id: "node-1",
    name: "Test Node",
    completionRule: CompletionRule.ALL_TASKS_DONE,
    tasks: [{ id: "task-1" }],
    transitiveSuccessors: ["node-2"]
  };

  const mockSnapshot: any = {
    nodes: [mockNode, { id: "node-2", tasks: [], transitiveSuccessors: [] }],
    gates: []
  };

  describe("computeValidityMap", () => {
    it("should tie-break by id DESC for identical createdAt", () => {
      const now = new Date();
      const events: any[] = [
        { id: "evt-a", taskExecutionId: "te-1", state: ValidityState.PROVISIONAL, createdAt: now },
        { id: "evt-b", taskExecutionId: "te-1", state: ValidityState.INVALID, createdAt: now },
      ];
      const map = computeValidityMap(events);
      expect(map.get("te-1")).toBe(ValidityState.INVALID);
    });

    it("should prefer latest createdAt", () => {
      const t1 = new Date("2026-01-01");
      const t2 = new Date("2026-01-02");
      const events: any[] = [
        { id: "evt-1", taskExecutionId: "te-1", state: ValidityState.INVALID, createdAt: t1 },
        { id: "evt-2", taskExecutionId: "te-1", state: ValidityState.VALID, createdAt: t2 },
      ];
      const map = computeValidityMap(events);
      expect(map.get("te-1")).toBe(ValidityState.VALID);
    });
  });

  describe("computeNodeComplete (Detour Aware)", () => {
    it("should NOT complete node if outcome is PROVISIONAL", () => {
      const taskExecutions: any[] = [
        { id: "te-1", taskId: "task-1", outcome: "DONE", iteration: 1 }
      ];
      const validityEvents: any[] = [
        { id: "v1", taskExecutionId: "te-1", state: ValidityState.PROVISIONAL, createdAt: new Date() }
      ];
      const validityMap = computeValidityMap(validityEvents);

      expect(computeNodeComplete(mockNode, taskExecutions, validityMap, 1)).toBe(false);
    });

    it("should complete node if outcome is VALID", () => {
      const taskExecutions: any[] = [
        { id: "te-1", taskId: "task-1", outcome: "DONE", iteration: 1 }
      ];
      const validityMap = new Map(); // Empty map defaults to VALID

      expect(computeNodeComplete(mockNode, taskExecutions, validityMap, 1)).toBe(true);
    });
  });

  describe("computeTaskActionable (Detour + Validity Aware)", () => {
    const nodeActivations: any[] = [{ nodeId: "node-1", iteration: 1 }];

    it("should re-open task if outcome is INVALID", () => {
      const taskExecutions: any[] = [
        { id: "te-1", taskId: "task-1", outcome: "DONE", iteration: 1 }
      ];
      const validityEvents: any[] = [
        { id: "v1", taskExecutionId: "te-1", state: ValidityState.INVALID, createdAt: new Date() }
      ];

      const actionable = computeTaskActionable(
        mockNode.tasks[0],
        mockNode,
        nodeActivations,
        taskExecutions,
        [],
        validityEvents,
        mockSnapshot
      );

      expect(actionable).toBe(true);
    });

    it("should block task if node is in blockedScope of active blocking detour", () => {
      const node2: any = mockSnapshot.nodes[1];
      const node2Activations: any[] = [{ nodeId: "node-2", iteration: 1 }];
      const detours: any[] = [
        { id: "d1", checkpointNodeId: "node-1", type: DetourType.BLOCKING, status: DetourStatus.ACTIVE }
      ];

      const actionable = computeTaskActionable(
        { id: "task-2" } as any,
        node2,
        node2Activations,
        [],
        detours,
        [],
        mockSnapshot
      );

      expect(actionable).toBe(false);
    });

    it("should block join if any inbound parent is blocked", () => {
      const joinNode: any = { id: "join", name: "Join", completionRule: CompletionRule.ALL_TASKS_DONE, tasks: [{ id: "t-j" }], transitiveSuccessors: [] };
      const snapshot: any = {
        nodes: [mockNode, joinNode],
        gates: [
          { sourceNodeId: "node-1", targetNodeId: "join", outcomeName: "DONE" }
        ]
      };
      const joinActivations: any[] = [{ nodeId: "join", iteration: 1 }];
      const detours: any[] = [
        { id: "d1", checkpointNodeId: "node-1", type: DetourType.BLOCKING, status: DetourStatus.ACTIVE }
      ];

      const actionable = computeTaskActionable(
        joinNode.tasks[0],
        joinNode,
        joinActivations,
        [],
        detours,
        [],
        snapshot
      );

      expect(actionable).toBe(false);
    });
  });

  describe("computeFlowComplete", () => {
    it("should return false if any ACTIVE detour exists", () => {
      const detours: any[] = [{ status: DetourStatus.ACTIVE }];
      expect(computeFlowComplete(mockSnapshot, [], [], detours, [])).toBe(false);
    });
  });
});
