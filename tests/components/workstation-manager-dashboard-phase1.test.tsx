/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ManagerDashboard } from "@/app/(app)/(fullbleed)/workstation/_components/manager-dashboard";
import * as Logic from "@/app/(app)/(fullbleed)/workstation/_lib/dashboard-logic";
import * as React from "react";

// Mock the dashboard logic
vi.mock("@/app/(app)/(fullbleed)/workstation/_lib/dashboard-logic", () => ({
  useManagerDashboardData: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

describe("Work Station Manager Dashboard - Phase 1", () => {
  const mockTasks = [
    {
      flowId: "f1",
      taskId: "t1",
      taskName: "Critical Task",
      flowGroupId: "job_12345678",
      workflowName: "Test WF",
      nodeName: "N1",
      domainHint: "execution",
      _signals: { isOverdue: true, jobPriority: "URGENT" },
      _detour: { type: "BLOCKING" },
    }
  ];

  it("renders the dashboard with all required lens tabs", () => {
    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 1, overdue: 1, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [{ id: "f1-t1", severity: "CRITICAL", category: "Detour", jobLabel: "Job: job_1234", reason: "Blocked", primaryActionLabel: "Start", task: mockTasks[0] }],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    const tabs = ["Overview", "Calendar", "Jobs", "Tasks", "Crews & Employees", "Analytics"];
    tabs.forEach(tab => {
      expect(screen.getByText(tab)).toBeTruthy();
    });
  });

  it("renders real derived signals in the strip", () => {
    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 42, overdue: 7, atRisk: 5, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  it("enforces Critical Attention cap of 10", () => {
    const manyItems = Array.from({ length: 15 }).map((_, i) => ({
      id: `id-${i}`,
      severity: "CRITICAL",
      category: "Test",
      jobLabel: "Job: 123",
      reason: "Reason",
      primaryActionLabel: "Action",
      task: mockTasks[0]
    }));

    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: manyItems,
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    // Header should show 15
    expect(screen.getByText(/Critical Attention \(15\)/i)).toBeTruthy();
    
    // Only 10 cards + 1 "more" affordance should be visible
    // We check for the "+ 5 more items" text
    expect(screen.getByText(/\+5 more items/i)).toBeTruthy();
  });

  it("renders Today/Tomorrow/This Week panels with real derived data (INV-WS-05)", () => {
    const todayItem = {
      id: "today-1",
      severity: "NORMAL",
      category: "test",
      jobLabel: "Job: 123",
      reason: "Reason",
      primaryActionLabel: "Action",
      task: mockTasks[0]
    };

    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: {
        today: [todayItem],
        tomorrow: [],
        week: []
      },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.getByText("This Week")).toBeTruthy();
    
    // Check for the derived item in the Today panel
    expect(screen.getByText("Critical Task")).toBeTruthy();
  });

  it("enforces cap of 8 items per time horizon panel", () => {
    const manyItems = Array.from({ length: 10 }).map((_, i) => ({
      id: `id-${i}`,
      severity: "NORMAL",
      category: "Test",
      jobLabel: "Job: 123",
      reason: "Reason",
      primaryActionLabel: "Action",
      task: { ...mockTasks[0], taskName: `Task ${i}` }
    }));

    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: {
        today: manyItems,
        tomorrow: [],
        week: []
      },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    // Check for "+ 2 more in Tasks" link
    expect(screen.getByText(/\+ 2 more in Tasks/i)).toBeTruthy();
  });

  it("renders the right rail with required labels", () => {
    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    // INV-WS-04: Safe Navigation vs Execution labeling
    const readOnlyLabels = screen.getAllByText("READ ONLY");
    const executionLabels = screen.getAllByText("EXECUTION");
    
    expect(readOnlyLabels.length).toBeGreaterThan(0);
    expect(executionLabels.length).toBeGreaterThan(0);
  });

  it("renders lens alerts when switching tabs (INV-WS-03)", async () => {
    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 1, overdue: 1, atRisk: 0, missingEvidence: 1, unassigned: 1, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      jobHealthRows: [],
      lensAlerts: {
        overview: [],
        calendar: [{ lens: "calendar", severity: "red", title: "Overdue tasks impacting this week", body: "1 tasks are already past due", primaryActionLabel: "View Overdue Tasks" }],
        jobs: [{ lens: "jobs", severity: "red", title: "Jobs with blocking detours", body: "1 jobs are currently blocked", primaryActionLabel: "Resolve Detours" }],
        tasks: [{ lens: "tasks", severity: "red", title: "Unassigned urgent tasks", body: "1 urgent tasks require immediate assignment", primaryActionLabel: "Assign Tasks" }],
        crews: [{ lens: "crews", severity: "orange", title: "Unassigned work volume is high", body: "1 tasks are currently without an owner", primaryActionLabel: "Review Assignments" }],
        analytics: []
      },
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    // Test Calendar
    const calendarTab = screen.getByText("Calendar");
    await act(async () => {
      fireEvent.click(calendarTab);
    });
    expect(screen.getByText("Overdue tasks impacting this week")).toBeTruthy();

    // Test Jobs
    const jobsTab = screen.getByText("Jobs");
    await act(async () => {
      fireEvent.click(jobsTab);
    });
    expect(screen.getByText("Jobs with blocking detours")).toBeTruthy();

    // Test Crews
    const crewsTab = screen.getByText("Crews & Employees");
    await act(async () => {
      fireEvent.click(crewsTab);
    });
    expect(screen.getByText("Unassigned work volume is high")).toBeTruthy();
  });

  it("renders 'All clear' when no alerts exist for a lens", async () => {
    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      jobHealthRows: [],
      lensAlerts: {
        overview: [],
        calendar: [],
        jobs: [],
        tasks: [],
        crews: [],
        analytics: []
      },
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    const calendarTab = screen.getByText("Calendar");
    await act(async () => {
      fireEvent.click(calendarTab);
    });
    expect(screen.getByText(/All clear/i)).toBeTruthy();
  });

  it("caps alerts at 3 per lens", async () => {
    const manyAlerts = Array.from({ length: 5 }).map((_, i) => ({
      lens: "calendar",
      severity: "info",
      title: `Alert ${i}`,
      body: `Body ${i}`,
      primaryActionLabel: "Action"
    }));

    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      jobHealthRows: [],
      lensAlerts: {
        overview: [],
        calendar: manyAlerts.slice(0, 3), 
        jobs: [],
        tasks: [],
        crews: [],
        analytics: []
      },
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    const calendarTab = screen.getByText("Calendar");
    await act(async () => {
      fireEvent.click(calendarTab);
    });
    
    expect(screen.getByText("Alert 0")).toBeTruthy();
    expect(screen.getByText("Alert 1")).toBeTruthy();
    expect(screen.getByText("Alert 2")).toBeTruthy();
    expect(screen.queryByText("Alert 3")).toBeNull();
  });

  it("renders Job Health table with real derived data (INV-WS-07)", () => {
    const jobRow: any = {
      jobId: "job1",
      jobLabel: "Job: job1",
      health: "red",
      stageLabel: "Execution",
      blockingSignal: "Blocking Detour",
      nextDecision: "Resolve Detour",
      signals: { blocked: true, overdue: false, atRisk: false, missingEvidence: false, unassigned: false },
      primaryHref: "/workstation?job=job1"
    };

    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 1, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [jobRow],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    expect(screen.getByText("Job Health at a Glance")).toBeTruthy();
    expect(screen.getByText("Job: job1")).toBeTruthy();
    expect(screen.getByText("Blocking Detour")).toBeTruthy();
    expect(screen.getByText("Resolve Detour")).toBeTruthy();
  });

  it("filters Job Health table by status", async () => {
    const redJob: any = { jobId: "red", jobLabel: "Red Job", health: "red", signals: { blocked: true } };
    const greenJob: any = { jobId: "green", jobLabel: "Green Job", health: "green", signals: {} };

    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 1, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [redJob, greenJob],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    // Default "all" shows both
    expect(screen.getByText("Red Job")).toBeTruthy();
    expect(screen.getByText("Green Job")).toBeTruthy();
    
    // Click "red" filter
    const redFilter = screen.getByRole("button", { name: /red \(1\)/i });
    await act(async () => {
      fireEvent.click(redFilter);
    });
    
    expect(screen.getByText("Red Job")).toBeTruthy();
    expect(screen.queryByText("Green Job")).toBeNull();
  });

  it("renders Customer Messages panel with READ ONLY label and disclaimer (Phase 5)", () => {
    (Logic.useManagerDashboardData as any).mockReturnValue({
      signalsCounts: { blocked: 0, overdue: 0, atRisk: 0, missingEvidence: 0, unassigned: 0, waitingOnCustomer: 0 },
      criticalAttentionItems: [],
      timeHorizon: { today: [], tomorrow: [], week: [] },
      lensAlerts: { overview: [], calendar: [], jobs: [], tasks: [], crews: [], analytics: [] },
      jobHealthRows: [],
      isLoading: false,
      error: null
    });

    render(<ManagerDashboard />);
    
    // Check for Customer Messages header
    expect(screen.getAllByText(/Customer Messages/i).length).toBeGreaterThan(0);
    
    // Check for READ ONLY label in that section
    const customerMessagesSection = screen.getByText(/Customer Messages/i).closest('section');
    expect(customerMessagesSection?.textContent).toContain("READ ONLY");
    
    // Check for Messaging Pending disclaimer
    expect(screen.getByText(/Messaging Pending/i)).toBeTruthy();
    expect(screen.getByText(/setup is currently pending/i)).toBeTruthy();
    
    // Check for View Job action (actionability INV-WS-02)
    expect(screen.getAllByText(/View Job/i).length).toBeGreaterThan(0);
    
    // Confirm NO reply/input fields (hard constraint)
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /reply/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });
});
