import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarProvider } from "@/components/nav/sidebar-context";

// Force dynamic rendering for authenticated routes
export const dynamic = "force-dynamic";

/**
 * Root layout for authenticated app routes.
 * 
 * Provides: auth redirect, sidebar shell, main content area.
 * Does NOT apply container padding - that's handled by child route group layouts:
 * - (main)/layout.tsx applies container for standard pages
 * - (fullbleed)/layout.tsx provides edge-to-edge canvas for builders
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
