import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Customers | Struxient",
  description: "Manage customer accounts",
};

/**
 * Customers - Customer account management
 * 
 * Future: Will display customer list, customer details, and related jobs.
 */
export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-1">Manage customer accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            View and manage customer accounts and their associated jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No customers to display.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
