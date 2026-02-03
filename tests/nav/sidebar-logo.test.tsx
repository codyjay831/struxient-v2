/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarProvider } from "@/components/nav/sidebar-context";
import { usePathname } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/flowspec"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

// Mock ThemeToggle to avoid ThemeProvider requirement
vi.mock("@/components/nav/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

// Mock lib/nav/appNav
vi.mock("@/lib/nav/appNav", () => ({
  getEnabledNavItems: vi.fn(() => []),
}));

describe("Sidebar Logo Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderSidebar = () => {
    return render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
  };

  it("opens the sidebar when logo is clicked while collapsed and does not render floating toggle", async () => {
    // Start collapsed
    localStorage.setItem("struxient-sidebar-collapsed", "true");
    renderSidebar();

    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("w-[60px]");

    // Verify no floating toggle button exists (it was the only one with PanelLeft/PanelLeftClose when collapsed)
    // The new logic renders the toggle button ONLY when !collapsed
    expect(screen.queryByRole("button", { name: /Collapse sidebar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Expand sidebar/i })).not.toBeNull(); // This is the logo's aria-label

    const logo = screen.getByTestId("sidebar-logo");
    fireEvent.click(logo);

    // Should now be expanded
    expect(aside.className).toContain("w-[240px]");
    // Toggle button should now appear
    expect(screen.getByRole("button", { name: /Collapse sidebar/i })).toBeDefined();
  });

  it("does nothing when logo is clicked while already expanded", async () => {
    // Start expanded
    localStorage.setItem("struxient-sidebar-collapsed", "false");
    renderSidebar();

    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("w-[240px]");

    const logo = screen.getByTestId("sidebar-logo");
    fireEvent.click(logo);

    // Should still be expanded
    expect(aside.className).toContain("w-[240px]");
  });

  it("is not a link and is a semantic button", () => {
    renderSidebar();
    const logo = screen.getByTestId("sidebar-logo");
    
    expect(logo.tagName).toBe("BUTTON");
    expect(logo.getAttribute("type")).toBe("button");
    expect(logo.closest("a")).toBeNull();
  });

  it("supports keyboard activation when collapsed", async () => {
    localStorage.setItem("struxient-sidebar-collapsed", "true");
    renderSidebar();

    const aside = screen.getByRole("complementary");
    const logo = screen.getByTestId("sidebar-logo");
    
    fireEvent.keyDown(logo, { key: "Enter" });
    expect(aside.className).toContain("w-[240px]");
  });
});
