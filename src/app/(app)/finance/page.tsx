import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isModuleEnabled } from "@/lib/modules/moduleFlags";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Finance | Struxient",
  description: "Financial management and reporting",
};

/**
 * Finance - Financial management
 * 
 * This is an OPTIONAL module that can be disabled.
 * Finance data may come from internal UI OR external integrations (e.g., QuickBooks).
 * 
 * Corner-safety: Do NOT assume Finance is permanent or the only source of financial data.
 * See: docs/canon/boundaries/FINANCE_BOUNDARY.md
 */
export default function FinancePage() {
  // Check if module is enabled
  if (!isModuleEnabled("finance")) {
    redirect("/workstation");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Finance</h1>
        <p className="text-muted-foreground mt-1">Financial management and reporting</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            Financial summaries and reporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No financial data to display.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
