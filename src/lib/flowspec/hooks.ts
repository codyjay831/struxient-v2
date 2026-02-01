/**
 * FlowSpec Post-Commit Hooks
 *
 * Scoped in-process hooks triggered after successful transaction commit.
 * Delivery: Best-effort.
 * Failure behavior: Logged, non-blocking.
 * Constraint: Hooks MUST NOT mutate truth (execution state).
 */

export type HookEvent =
  | { type: "TASK_STARTED"; flowId: string; taskId: string; userId: string }
  | { type: "TASK_DONE"; flowId: string; taskId: string; outcome: string; userId: string }
  | { type: "NODE_ACTIVATED"; flowId: string; nodeId: string; iteration: number }
  | { type: "FLOW_COMPLETED"; flowId: string };

export type HookCallback = (event: HookEvent) => Promise<void> | void;

class HookRegistry {
  private callbacks: HookCallback[] = [];

  subscribe(callback: HookCallback) {
    this.callbacks.push(callback);
  }

  async emit(event: HookEvent) {
    for (const callback of this.callbacks) {
      try {
        await callback(event);
      } catch (err) {
        console.error(`[FlowSpec Hook Error] Event ${event.type} failed:`, err);
      }
    }
  }
}

export const hookRegistry = new HookRegistry();

/**
 * Coordination context for managing hooks during a transaction.
 */
export class HookContext {
  private pendingEvents: HookEvent[] = [];

  queue(event: HookEvent) {
    this.pendingEvents.push(event);
  }

  async flush() {
    for (const event of this.pendingEvents) {
      await hookRegistry.emit(event);
    }
    this.pendingEvents = [];
  }
}
