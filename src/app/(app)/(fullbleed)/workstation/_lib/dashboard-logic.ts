"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ActionableTask } from "../_components/task-feed";
import { isToday, isTomorrow, isThisWeek, parseISO, startOfDay } from "date-fns";

export interface DashboardItem {
  id: string;
  severity: "CRITICAL" | "AT RISK" | "NORMAL";
  category: string;
  jobLabel: string;
  reason: string;
  primaryActionLabel: string;
  task: ActionableTask;
}

export type LensType = "overview" | "calendar" | "jobs" | "tasks" | "crews" | "analytics";

export interface LensAlert {
  lens: LensType;
  severity: "red" | "orange" | "info";
  title: string;
  body: string;
  primaryActionLabel: string;
  primaryHref?: string;
}

export interface JobHealthRow {
  jobId: string;
  jobLabel: string;
  health: "green" | "orange" | "red";
  stageLabel: string;
  blockingSignal: string | null;
  nextDecision: string | null;
  signals: { 
    blocked: boolean; 
    overdue: boolean; 
    atRisk: boolean; 
    missingEvidence: boolean; 
    unassigned: boolean; 
  };
  primaryHref: string;
}

export interface DashboardData {
  signalsCounts: {
    blocked: number;
    atRisk: number;
    waitingOnCustomer: number; // derivation pending
    missingEvidence: number;
    unassigned: number;
    overdue: number;
  };
  criticalAttentionItems: DashboardItem[];
  timeHorizon: {
    today: DashboardItem[];
    tomorrow: DashboardItem[];
    week: DashboardItem[];
  };
  lensAlerts: Record<LensType, LensAlert[]>;
  jobHealthRows: JobHealthRow[];
  allActionableTasks: ActionableTask[];
  isLoading: boolean;
  error: string | null;
}

export function useManagerDashboardData() {
  const [tasks, setTasks] = useState<ActionableTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/flowspec/actionable-tasks");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch tasks");
      }
      const data = await response.json();
      setTasks(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const dashboardData = useMemo((): DashboardData => {
    // 1. Calculate Signals
    const signalsCounts = {
      blocked: tasks.filter(t => t._detour?.type === 'BLOCKING').length,
      overdue: tasks.filter(t => t._signals?.isOverdue).length,
      atRisk: tasks.filter(t => 
        (t._signals?.jobPriority === 'URGENT' || t._signals?.jobPriority === 'HIGH' || t._signals?.isDueSoon) && 
        !t._signals?.isOverdue && 
        t._detour?.type !== 'BLOCKING'
      ).length,
      missingEvidence: tasks.filter(t => t.diagnostics?.evidence?.status === 'missing').length,
      unassigned: tasks.filter(t => !t._metadata?.assignments || t._metadata.assignments.length === 0).length,
      waitingOnCustomer: 0, // derivation pending
    };

    // Helper to map task to DashboardItem
    const mapToItem = (t: ActionableTask): DashboardItem => ({
      id: `${t.flowId}-${t.taskId}`,
      severity: (t._detour?.type === 'BLOCKING' || t._signals?.isOverdue) ? "CRITICAL" : 
                (t._signals?.jobPriority === 'URGENT' || t._signals?.isDueSoon) ? "AT RISK" : "NORMAL",
      category: t._detour ? "Detour" : t._signals?.isOverdue ? "Overdue" : t.domainHint,
      jobLabel: `Job: ${t.flowGroupId.slice(0, 8)}`,
      reason: t._detour?.message || t._signals?.isOverdue ? `Task "${t.taskName}" is overdue.` : `Attention required for "${t.taskName}".`,
      primaryActionLabel: t.startedAt ? "Continue Work" : "Start Task",
      task: t
    });

    // 2. Identify Critical Attention Items (INV-WS-01, INV-WS-02)
    const criticalTasks = tasks
      .filter(t => t._detour?.type === 'BLOCKING' || t._signals?.isOverdue || t._signals?.jobPriority === 'URGENT')
      .sort((a, b) => {
        if (a._detour?.type === 'BLOCKING' && b._detour?.type !== 'BLOCKING') return -1;
        if (b._detour?.type === 'BLOCKING' && a._detour?.type !== 'BLOCKING') return 1;
        if (a._signals?.isOverdue && !b._signals?.isOverdue) return -1;
        if (b._signals?.isOverdue && !a._signals?.isOverdue) return 1;
        return 0;
      });

    // 3. Time Horizon Grouping (INV-WS-05, INV-WS-06)
    const today: DashboardItem[] = [];
    const tomorrow: DashboardItem[] = [];
    const week: DashboardItem[] = [];

    const now = new Date();

    tasks.forEach(t => {
      const item = mapToItem(t);
      const dueAtStr = t._signals?.effectiveDueAt;
      
      if (dueAtStr) {
        const dueAt = new Date(dueAtStr);
        if (isToday(dueAt) || dueAt < now) {
          today.push(item);
        } else if (isTomorrow(dueAt)) {
          tomorrow.push(item);
        } else if (isThisWeek(dueAt)) {
          week.push(item);
        }
      } else if (t._signals?.isOverdue) {
        today.push(item);
      } else if (t._signals?.jobPriority === 'URGENT') {
        today.push(item);
      }
    });

    // 4. Lens Alerts Derivation (Phase 3 - INV-WS-03)
    const lensAlerts: Record<LensType, LensAlert[]> = {
      overview: [],
      calendar: [],
      jobs: [],
      tasks: [],
      crews: [],
      analytics: [],
    };

    // A) Calendar lens alerts
    if (signalsCounts.overdue > 0) {
      lensAlerts.calendar.push({
        lens: "calendar",
        severity: "red",
        title: "Overdue tasks impacting this week",
        body: `${signalsCounts.overdue} tasks are already past due and affecting the schedule.`,
        primaryActionLabel: "View Overdue Tasks",
        primaryHref: "/workstation?lens=tasks&filter=overdue"
      });
    }
    const blockingDueSoon = tasks.filter(t => t._detour?.type === 'BLOCKING' && t._signals?.isDueSoon).length;
    if (blockingDueSoon > 0) {
      lensAlerts.calendar.push({
        lens: "calendar",
        severity: "orange",
        title: "Blocking detours that will delay work",
        body: `${blockingDueSoon} blocking detours are affecting tasks due within 24 hours.`,
        primaryActionLabel: "Fix Conflicts",
        primaryHref: "/workstation?lens=overview"
      });
    }

    // B) Jobs lens alerts
    if (signalsCounts.blocked > 0) {
      lensAlerts.jobs.push({
        lens: "jobs",
        severity: "red",
        title: "Jobs with blocking detours",
        body: `${signalsCounts.blocked} jobs are currently blocked by detours.`,
        primaryActionLabel: "Resolve Detours",
        primaryHref: "/workstation?lens=overview"
      });
    }
    if (signalsCounts.missingEvidence > 0) {
      lensAlerts.jobs.push({
        lens: "jobs",
        severity: "orange",
        title: "Jobs missing evidence",
        body: `${signalsCounts.missingEvidence} jobs have tasks missing required evidence.`,
        primaryActionLabel: "View Missing Evidence",
        primaryHref: "/workstation?lens=tasks&filter=missing_evidence"
      });
    }

    // C) Tasks lens alerts
    if (signalsCounts.unassigned > 0) {
      const urgentUnassigned = tasks.filter(t => (!t._metadata?.assignments || t._metadata.assignments.length === 0) && t._signals?.jobPriority === 'URGENT').length;
      if (urgentUnassigned > 0) {
        lensAlerts.tasks.push({
          lens: "tasks",
          severity: "red",
          title: "Unassigned urgent tasks",
          body: `${urgentUnassigned} urgent tasks require immediate assignment.`,
          primaryActionLabel: "Assign Tasks",
          primaryHref: "/workstation?lens=crews"
        });
      }
    }

    // D) Crews lens alerts
    if (signalsCounts.unassigned > 5) {
      lensAlerts.crews.push({
        lens: "crews",
        severity: "orange",
        title: "Unassigned work volume is high",
        body: `${signalsCounts.unassigned} tasks are currently without an owner.`,
        primaryActionLabel: "Review Assignments",
        primaryHref: "/workstation?lens=tasks&filter=unassigned"
      });
    }

    // E) Analytics lens alerts
    if (signalsCounts.overdue / (tasks.length || 1) > 0.2) {
      lensAlerts.analytics.push({
        lens: "analytics",
        severity: "red",
        title: "Overdue rate elevated",
        body: `Over 20% of current tasks are overdue.`,
        primaryActionLabel: "View Overdue Tasks",
        primaryHref: "/workstation?lens=tasks&filter=overdue"
      });
    }
    if (signalsCounts.blocked > 3) {
      lensAlerts.analytics.push({
        lens: "analytics",
        severity: "info",
        title: "Detours trending high",
        body: `There are ${signalsCounts.blocked} active blocking detours.`,
        primaryActionLabel: "View Blocking Detours",
        primaryHref: "/workstation?lens=overview"
      });
    }

    // 5. Job Health Table Derivation (Phase 4 - INV-WS-07)
    const jobsMap = new Map<string, ActionableTask[]>();
    tasks.forEach(t => {
      const jobTasks = jobsMap.get(t.flowGroupId) || [];
      jobTasks.push(t);
      jobsMap.set(t.flowGroupId, jobTasks);
    });

    const jobHealthRows: JobHealthRow[] = Array.from(jobsMap.entries()).map(([flowGroupId, jobTasks]) => {
      const hasBlockingDetour = jobTasks.some(t => t._detour?.type === 'BLOCKING');
      const hasOverdueUrgent = jobTasks.some(t => t._signals?.isOverdue && (t._signals?.jobPriority === 'URGENT' || t._signals?.jobPriority === 'HIGH'));
      const hasOverdue = jobTasks.some(t => t._signals?.isOverdue);
      const hasDueSoon = jobTasks.some(t => t._signals?.isDueSoon);
      const hasMissingEvidence = jobTasks.some(t => t.diagnostics?.evidence?.status === 'missing');
      const hasUnassignedUrgent = jobTasks.some(t => (!t._metadata?.assignments || t._metadata.assignments.length === 0) && t._signals?.jobPriority === 'URGENT');
      const hasUnassigned = jobTasks.some(t => !t._metadata?.assignments || t._metadata.assignments.length === 0);

      // INV-WS-07 Health Mapping
      let health: "red" | "orange" | "green" = "green";
      let blockingSignal: string | null = null;
      let nextDecision: string | null = null;

      if (hasBlockingDetour || hasOverdueUrgent) {
        health = "red";
        blockingSignal = hasBlockingDetour ? "Blocking Detour" : "Overdue (Urgent)";
        nextDecision = hasBlockingDetour ? "Resolve Detour" : "Execute Task";
      } else if (hasOverdue || hasDueSoon || hasMissingEvidence || hasUnassigned) {
        health = "orange";
        blockingSignal = hasOverdue ? "Overdue" : hasMissingEvidence ? "Missing Evidence" : hasUnassigned ? "Unassigned" : "Due Soon";
        nextDecision = hasUnassigned ? "Assign Task" : hasMissingEvidence ? "Collect Evidence" : "Review Schedule";
      }

      // Stage label: Deterministic selection (Phase 4 NIT-2)
      // Rule: Pick nodeName from the highest-severity task contributing to job health.
      // Severity order: Blocking Detour > Overdue > At Risk > Normal
      const prioritizedTasks = [...jobTasks].sort((a, b) => {
        const getScore = (t: ActionableTask) => {
          if (t._detour?.type === 'BLOCKING') return 4;
          if (t._signals?.isOverdue) return 3;
          if (t._signals?.jobPriority === 'URGENT' || t._signals?.isDueSoon) return 2;
          return 1;
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        // Tie-breaker: earliest due date, then canonical taskId
        const dueA = a._signals?.effectiveDueAt ? new Date(a._signals.effectiveDueAt).getTime() : Infinity;
        const dueB = b._signals?.effectiveDueAt ? new Date(b._signals.effectiveDueAt).getTime() : Infinity;
        if (dueA !== dueB) return dueA - dueB;
        return a.taskId.localeCompare(b.taskId);
      });

      const stageLabel = prioritizedTasks[0]?.nodeName || "Unknown";

      return {
        jobId: flowGroupId,
        jobLabel: `Job: ${flowGroupId.slice(0, 8)}`,
        health,
        stageLabel,
        blockingSignal,
        nextDecision,
        signals: {
          blocked: hasBlockingDetour,
          overdue: hasOverdue,
          atRisk: hasDueSoon || hasOverdueUrgent,
          missingEvidence: hasMissingEvidence,
          unassigned: hasUnassigned,
        },
        primaryHref: `/workstation?job=${flowGroupId}`
      };
    });

    // Cap at 3 alerts per lens (excluding overview)
    Object.keys(lensAlerts).forEach((key) => {
      const lens = key as LensType;
      if (lens !== "overview") {
        lensAlerts[lens] = lensAlerts[lens].slice(0, 3);
      }
    });

    return {
      signalsCounts,
      criticalAttentionItems: criticalTasks.map(mapToItem),
      timeHorizon: {
        today: today.sort((a, b) => (a.severity === "CRITICAL" ? -1 : 1)),
        tomorrow: tomorrow,
        week: week,
      },
      lensAlerts,
      jobHealthRows,
      allActionableTasks: tasks,
      isLoading,
      error,
    };
  }, [tasks, isLoading, error]);

  return dashboardData;
}
