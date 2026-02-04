/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OutcomesEditor } from "@/components/flowspec/outcomes-editor";
import { RoutingEditor } from "@/components/flowspec/routing-editor";
import { EdgeDetailPanel } from "@/components/flowspec/edge-detail-panel";
import { CreateNextNodeDialog } from "@/components/flowspec/create-next-node-dialog";
import * as React from "react";

// Mock Tooltip components
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Dialog components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode, open: boolean }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Card components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockNodes = [{ id: "node-1", name: "First Node", position: { x: 100, y: 100 } }];
const mockOutcomes = [{ id: "out-1", name: "SUCCESS" }];

describe("Routing Labels & Creation Regression", () => {
  it("renders correct labels and creation affordance in OutcomesEditor", () => {
    render(
      <OutcomesEditor
        workflowId="wf-1"
        nodeId="node-0"
        taskId="task-1"
        outcomes={mockOutcomes}
        nodes={mockNodes}
        gates={[]}
        isEditable={true}
        onOutcomesUpdated={() => {}}
      />
    );

    expect(screen.getByText(/Next node:/i)).toBeTruthy();
    expect(screen.getByText(/\+ Create next node\.\.\./i)).toBeTruthy();
    expect(screen.getByText(/✨ Assisted create & route\.\.\./i)).toBeTruthy();
  });

  it("renders correct labels and creation affordance in RoutingEditor", () => {
    render(
      <RoutingEditor
        workflowId="wf-1"
        nodes={[{ 
          id: "node-0", 
          name: "Source", 
          tasks: [{ id: "t1", outcomes: mockOutcomes }],
          position: { x: 0, y: 0 } 
        } as any]}
        gates={[]}
        isEditable={true}
        onRoutingUpdated={() => {}}
      />
    );

    expect(screen.getByText(/1 orphaned \(missing target\)/i)).toBeTruthy();
    expect(screen.getAllByText(/\+ Create next node\.\.\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/✨ Assisted create & route\.\.\./i).length).toBeGreaterThan(0);
  });

  describe("CreateNextNodeDialog Modes", () => {
    it("standard mode: has empty name field and no assisted title", () => {
      render(
        <CreateNextNodeDialog
          workflowId="wf-1"
          sourceNodeId="node-0"
          sourceNodeName="Source Node"
          outcomeName="SUCCESS"
          open={true}
          onOpenChange={() => {}}
          onCreated={() => {}}
          mode="standard"
        />
      );

      expect(screen.getByText(/Create Next Node/i)).toBeTruthy();
      expect(screen.queryByText(/Assisted/i)).toBeNull();
      
      const input = screen.getByLabelText(/Node Name/i) as HTMLInputElement;
      expect(input.value).toBe("");
    });

    it("assisted mode: has prefilled name field and assisted title", () => {
      render(
        <CreateNextNodeDialog
          workflowId="wf-1"
          sourceNodeId="node-0"
          sourceNodeName="Source Node"
          outcomeName="SUCCESS"
          open={true}
          onOpenChange={() => {}}
          onCreated={() => {}}
          mode="assisted"
        />
      );

      expect(screen.getByText(/Assisted Create & Route/i)).toBeTruthy();
      
      const input = screen.getByLabelText(/Node Name/i) as HTMLInputElement;
      expect(input.value).toBe("Handle SUCCESS");
    });
  });
});

