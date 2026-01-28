import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarProvider } from "@/components/nav/sidebar-context";
import { isRouteModuleEnabled } from "@/lib/nav/appNav";
import { headers } from "next/headers";

// Force dynamic rendering for authenticated routes
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if the current route's module is enabled
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // Module check will be handled by individual pages for simplicity
  // The sidebar already filters out disabled modules

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 md:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
