import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Jobs | Struxient",
  description: "Manage jobs and work orders",
};

/**
 * Jobs - Work order management
 * 
 * Future: Will display job list, job details, and job-related actions.
 * Jobs flow through FlowSpec-defined workflows.
 */
export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground mt-1">Manage jobs and work orders</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
          <CardDescription>
            View and manage active jobs across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No jobs to display.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
