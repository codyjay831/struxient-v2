import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Work Station | Struxient",
  description: "Your daily work at a glance",
};

/**
 * Work Station - Post-login landing page
 * 
 * This page will eventually display:
 * - Tasks derived from FlowSpec (actionability computed by engine)
 * - Today's work items across Jobs, Customers, etc.
 * 
 * IMPORTANT: Actionability logic lives in FlowSpec engine, NOT here.
 * This page only renders what the engine surfaces.
 */
export default function WorkStationPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Work Station</h1>
        <p className="text-muted-foreground mt-1">Today&apos;s work</p>
      </div>

      {/* Tasks Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actionable Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No actionable tasks (yet).
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Tasks will appear here when FlowSpec surfaces work for you.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions / Overview - placeholder for future */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jobs in Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">—</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
