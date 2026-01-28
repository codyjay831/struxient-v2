import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isModuleEnabled } from "@/lib/modules/moduleFlags";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sales | Struxient",
  description: "Sales pipeline and opportunities",
};

/**
 * Sales - Sales pipeline management
 * 
 * This is an OPTIONAL module that can be disabled.
 * Sales outcomes may come from internal UI OR external integrations.
 * 
 * Corner-safety: Do NOT assume Sales is permanent or the only source of sales data.
 */
export default function SalesPage() {
  // Check if module is enabled
  if (!isModuleEnabled("sales")) {
    redirect("/workstation");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sales</h1>
        <p className="text-muted-foreground mt-1">Sales pipeline and opportunities</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>
            Track sales opportunities and pipeline progression.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No opportunities to display.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
