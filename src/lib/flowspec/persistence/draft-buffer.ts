/**
 * FlowSpec Builder Draft Buffer Persistence
 * 
 * Handles work-in-progress (WIP) semantic changes for the workflow builder.
 * 
 * Canon: Builder Save Safety v1
 */

import { prisma } from "@/lib/prisma";
import { createWorkflowSnapshot } from "../lifecycle/versioning";
import { findWorkflowById } from "./workflow";
import { DraftEventType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Get the current draft buffer for a workflow.
 */
export async function getDraftBuffer(workflowId: string, companyId: string) {
  return prisma.workflowDraftBuffer.findUnique({
    where: { companyId_workflowId: { companyId, workflowId } },
  });
}

/**
 * Update a gate in the draft buffer.
 */
export async function updateGateInBuffer(
  workflowId: string,
  companyId: string,
  gateId: string,
  updates: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const gateIndex = content.gates.findIndex((g: any) => g.id === gateId);
    if (gateIndex === -1) throw new Error("Gate not found in draft buffer");

    content.gates[gateIndex] = {
      ...content.gates[gateIndex],
      ...updates,
    };

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Delete a gate from the draft buffer.
 */
export async function deleteGateFromBuffer(
  workflowId: string,
  companyId: string,
  gateId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    content.gates = content.gates.filter((g: any) => g.id !== gateId);

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Add a new node to the draft buffer.
 */
export async function addNodeToBuffer(
  workflowId: string,
  companyId: string,
  nodeData: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const newNode = {
      id: `node_${randomUUID()}`,
      tasks: [],
      ...nodeData,
    };

    content.nodes.push(newNode);

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Upsert the draft buffer with new semantic content.
 */
export async function upsertDraftBuffer(
  workflowId: string,
  companyId: string,
  content: any,
  userId: string
) {
  return prisma.workflowDraftBuffer.upsert({
    where: { companyId_workflowId: { companyId, workflowId } },
    create: {
      workflowId,
      companyId,
      content,
      updatedBy: userId,
    },
    update: {
      content,
      updatedBy: userId,
    },
  });
}

/**
 * Delete the draft buffer.
 */
export async function deleteDraftBuffer(workflowId: string, companyId: string) {
  return prisma.workflowDraftBuffer.delete({
    where: { companyId_workflowId: { companyId, workflowId } },
  });
}

/**
 * Seed the buffer from relational tables if it doesn't exist.
 * Also creates the INITIAL event and sets it as the baseEventId.
 * 
 * @param workflowId - The workflow ID
 * @param companyId - The company ID
 * @param userId - The user ID performing the operation
 * @param existingTx - Optional Prisma transaction client to use
 */
export async function ensureDraftBuffer(
  workflowId: string,
  companyId: string,
  userId: string,
  existingTx?: Prisma.TransactionClient
) {
  const execute = async (tx: Prisma.TransactionClient) => {
    // 1. Check if buffer already exists
    const existing = await tx.workflowDraftBuffer.findUnique({
      where: { companyId_workflowId: { companyId, workflowId } },
    });

    if (existing) return existing;

    // 2. Fetch full workflow to create initial snapshot
    const workflow = await findWorkflowById(workflowId, tx);
    if (!workflow) throw new Error("Workflow not found");
    if (workflow.companyId !== companyId) throw new Error("Tenant mismatch");

    // 3. Create semantic snapshot
    const semanticSnapshot = createWorkflowSnapshot(workflow);

    // 4. Create composite snapshot (Semantic + Layout)
    const nodePositions = workflow.nodes.map(n => ({ id: n.id, position: n.position }));
    const compositeSnapshot = {
      ...semanticSnapshot,
      layout: nodePositions,
    };

    // 5. Check if history already exists to determine seq and anchor
    const latestEvent = await tx.workflowDraftEvent.findFirst({
      where: { workflowId },
      orderBy: { seq: "desc" },
    });

    let anchorEventId = latestEvent?.id;

    if (!latestEvent) {
      // Create INITIAL event if none exist
      const initialEvent = await tx.workflowDraftEvent.create({
        data: {
          companyId,
          workflowId,
          seq: 1,
          type: DraftEventType.INITIAL,
          label: "Initial State",
          snapshot: compositeSnapshot as any,
          createdBy: userId,
        },
      });
      anchorEventId = initialEvent.id;
    }

    // 6. Create buffer pointing to the anchor event
    return tx.workflowDraftBuffer.create({
      data: {
        companyId,
        workflowId,
        content: semanticSnapshot as any,
        updatedBy: userId,
        baseEventId: anchorEventId,
      },
    });
  };

  if (existingTx) {
    return execute(existingTx);
  }

  return prisma.$transaction(execute);
}

/**
 * Update a specific node in the buffer's semantic content.
 */
export async function updateNodeInBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  updates: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    content.nodes[nodeIndex] = {
      ...content.nodes[nodeIndex],
      ...updates,
    };

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Delete a node from the buffer.
 */
export async function deleteNodeFromBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    content.nodes = content.nodes.filter((n: any) => n.id !== nodeId);
    // Also remove any gates referencing this node
    content.gates = content.gates.filter((g: any) => g.sourceNodeId !== nodeId && g.targetNodeId !== nodeId);

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Add a new task to a node in the draft buffer.
 */
export async function addTaskToBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  taskData: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    const newTask = {
      id: `task_${randomUUID()}`,
      outcomes: [],
      crossFlowDependencies: [],
      ...taskData,
    };

    content.nodes[nodeIndex].tasks.push(newTask);

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Update a task in the draft buffer.
 */
export async function updateTaskInBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  taskId: string,
  updates: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    const taskIndex = content.nodes[nodeIndex].tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found in draft buffer");

    content.nodes[nodeIndex].tasks[taskIndex] = {
      ...content.nodes[nodeIndex].tasks[taskIndex],
      ...updates,
    };

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Delete a task from the draft buffer.
 */
export async function deleteTaskFromBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  taskId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    content.nodes[nodeIndex].tasks = content.nodes[nodeIndex].tasks.filter(
      (t: any) => t.id !== taskId
    );

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Reorder tasks in a node in the draft buffer.
 */
export async function reorderTasksInBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  order: string[],
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    const node = content.nodes[nodeIndex];
    const taskMap = new Map(node.tasks.map((t: any) => [t.id, t]));

    node.tasks = order.map((id) => {
      const task = taskMap.get(id);
      if (!task) throw new Error(`Task ${id} not found in node ${nodeId}`);
      return task;
    });

    // Also update displayOrder based on new index
    node.tasks.forEach((t: any, i: number) => {
      t.displayOrder = i;
    });

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Add a new outcome to a task in the draft buffer.
 */
export async function addOutcomeToBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  taskId: string,
  outcomeData: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    const taskIndex = content.nodes[nodeIndex].tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found in draft buffer");

    const newOutcome = {
      id: `outcome_${randomUUID()}`,
      ...outcomeData,
    };

    content.nodes[nodeIndex].tasks[taskIndex].outcomes.push(newOutcome);

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Update an outcome in the draft buffer.
 */
export async function updateOutcomeInBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  taskId: string,
  outcomeId: string,
  updates: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    const taskIndex = content.nodes[nodeIndex].tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found in draft buffer");

    const outcomeIndex = content.nodes[nodeIndex].tasks[taskIndex].outcomes.findIndex(
      (o: any) => o.id === outcomeId
    );
    if (outcomeIndex === -1) throw new Error("Outcome not found in draft buffer");

    const oldName = content.nodes[nodeIndex].tasks[taskIndex].outcomes[outcomeIndex].name;
    const newName = updates.name;

    content.nodes[nodeIndex].tasks[taskIndex].outcomes[outcomeIndex] = {
      ...content.nodes[nodeIndex].tasks[taskIndex].outcomes[outcomeIndex],
      ...updates,
    };

    // If outcome name changed, we MUST update any gates referencing this outcome
    if (newName && oldName !== newName) {
      content.gates.forEach((gate: any) => {
        if (gate.sourceNodeId === nodeId && gate.outcomeName === oldName) {
          gate.outcomeName = newName;
        }
      });
    }

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Delete an outcome from the draft buffer.
 */
export async function deleteOutcomeFromBuffer(
  workflowId: string,
  companyId: string,
  nodeId: string,
  taskId: string,
  outcomeId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const nodeIndex = content.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new Error("Node not found in draft buffer");

    const taskIndex = content.nodes[nodeIndex].tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found in draft buffer");

    const outcome = content.nodes[nodeIndex].tasks[taskIndex].outcomes.find(
      (o: any) => o.id === outcomeId
    );
    if (!outcome) throw new Error("Outcome not found in draft buffer");

    const outcomeName = outcome.name;

    content.nodes[nodeIndex].tasks[taskIndex].outcomes = content.nodes[nodeIndex].tasks[
      taskIndex
    ].outcomes.filter((o: any) => o.id !== outcomeId);

    // Also remove any gates referencing this outcome
    content.gates = content.gates.filter(
      (g: any) => !(g.sourceNodeId === nodeId && g.outcomeName === outcomeName)
    );

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}

/**
 * Add a new gate to the draft buffer.
 */
export async function addGateToBuffer(
  workflowId: string,
  companyId: string,
  gateData: any,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const buffer = await ensureDraftBuffer(workflowId, companyId, userId, tx);
    const content = buffer.content as any;

    const newGate = {
      id: `gate_${randomUUID()}`,
      ...gateData,
    };

    content.gates.push(newGate);

    return tx.workflowDraftBuffer.update({
      where: { id: buffer.id },
      data: {
        content: content as any,
        updatedBy: userId,
      },
    });
  });
}
