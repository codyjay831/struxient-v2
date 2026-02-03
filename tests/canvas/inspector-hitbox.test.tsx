/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import * as React from "react";

describe("Sheet Close Hitbox Regression", () => {
  it("ensures the close button has a higher z-index than a sticky header", () => {
    render(
      <Sheet open={true}>
        <SheetContent side="right">
          <SheetHeader className="sticky top-0 z-10">
            <SheetTitle>Test Header</SheetTitle>
          </SheetHeader>
          <div>Content</div>
        </SheetContent>
      </Sheet>
    );

    // Find the close button (SheetPrimitive.Close)
    const closeButton = screen.getByRole("button", { name: /close/i });
    
    // Verify it has the z-20 class to stay above the z-10 header
    expect(closeButton.className).toContain("z-20");
  });

  it("closes the sheet when the close button is clicked even with sticky header present", async () => {
    const onOpenChange = vi.fn();
    
    render(
      <Sheet open={true} onOpenChange={onOpenChange}>
        <SheetContent side="right">
          <SheetHeader className="sticky top-0 z-10">
            <SheetTitle>Test Header</SheetTitle>
          </SheetHeader>
          <div>Content</div>
        </SheetContent>
      </Sheet>
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    
    // Click the button
    fireEvent.click(closeButton);

    // Verify it triggers the close behavior
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
