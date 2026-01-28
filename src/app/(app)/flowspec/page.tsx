import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "FlowSpec Builder | Struxient",
  description: "Design and manage workflow specifications",
};

/**
 * FlowSpec Builder - Workflow design interface
 * 
 * Future: Will render the FlowSpec visual builder.
 * See: docs/canon/flowspec/ for specification details.
 */
export default function FlowSpecPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">FlowSpec Builder</h1>
        <p className="text-muted-foreground mt-1">Design and manage workflow specifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Specifications</CardTitle>
          <CardDescription>
            Create and edit FlowSpecs that define how work moves through your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              FlowSpec Builder coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
