import { describe, it, expect } from "vitest";
import { generateEdgeKey, slugify } from "@/lib/canvas/layout";

describe("Edge Identity & Determinism", () => {
  it("generates deterministic canonical edge keys", () => {
    const key = generateEdgeKey("node-1", "Submit Form", "node-2");
    expect(key).toBe("node-1::Submit Form::node-2");
  });

  it("handles terminal nodes in edge keys", () => {
    const key = generateEdgeKey("node-1", "Reject", null);
    expect(key).toBe("node-1::Reject::terminal");
  });

  it("generates safe slugs for data-testids", () => {
    expect(slugify("Submit Form!")).toBe("submit-form");
    expect(slugify("  Lots   of Spaces  ")).toBe("lots-of-spaces");
    expect(slugify("Path::Re-entry")).toBe("path-re-entry");
  });
});
