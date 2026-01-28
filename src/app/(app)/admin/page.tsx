import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Admin | Struxient",
  description: "System administration",
};

/**
 * Admin - System administration
 * 
 * Future: User management, tenant settings, integrations, etc.
 */
export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1">System administration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Administration</CardTitle>
          <CardDescription>
            Manage users, settings, and integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              Admin tools coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
