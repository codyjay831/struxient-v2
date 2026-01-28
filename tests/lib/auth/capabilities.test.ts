/**
 * Proof test for the capability-based permission system.
 *
 * This test demonstrates:
 * 1. hasCapability evaluation order (member deny → member allow → role default → deny)
 * 2. omitCostFields behavior when user lacks view_cost
 * 3. Response shape stability (fields nulled, not removed)
 */

import { describe, it, expect } from "vitest";
import {
  hasCapability,
  omitCostFields,
  buildAuthorityContext,
  parseCapabilities,
  type AuthorityContext,
} from "@/lib/auth/capabilities";

// =============================================================================
// TEST DATA
// =============================================================================

/** Sample data representing a line item with cost information */
const sampleLineItem = {
  id: "li_001",
  description: "Widget Installation",
  quantity: 5,
  // Cost-class fields (should be nulled for users without view_cost)
  unitCost: 100,
  cost: 500,
  margin: 0.25,
  markup: 125,
  profit: 125,
  // Customer-facing total (NOT a cost field - required for execution)
  total: 625,
};

/** Sample response with nested cost data */
const sampleQuoteResponse = {
  id: "quote_001",
  status: "draft",
  customer: {
    id: "cust_001",
    name: "Acme Corp",
  },
  lineItems: [sampleLineItem],
  // Summary costs
  costTotal: 500,
  internalTotal: 500,
  grossProfit: 125,
  // Customer-facing totals (NOT cost fields)
  subtotal: 625,
  total: 625,
};

// =============================================================================
// hasCapability TESTS
// =============================================================================

describe("hasCapability", () => {
  describe("role defaults for view_cost", () => {
    it("OWNER has view_cost by default", () => {
      const ctx: AuthorityContext = {
        role: "OWNER",
        capabilities: { allow: [], deny: [] },
      };
      expect(hasCapability(ctx, "view_cost")).toBe(true);
    });

    it("ADMIN has view_cost by default", () => {
      const ctx: AuthorityContext = {
        role: "ADMIN",
        capabilities: { allow: [], deny: [] },
      };
      expect(hasCapability(ctx, "view_cost")).toBe(true);
    });

    it("MANAGER has view_cost by default", () => {
      const ctx: AuthorityContext = {
        role: "MANAGER",
        capabilities: { allow: [], deny: [] },
      };
      expect(hasCapability(ctx, "view_cost")).toBe(true);
    });

    it("WORKER does NOT have view_cost by default", () => {
      const ctx: AuthorityContext = {
        role: "WORKER",
        capabilities: { allow: [], deny: [] },
      };
      expect(hasCapability(ctx, "view_cost")).toBe(false);
    });
  });

  describe("evaluation order", () => {
    it("member deny overrides role default (ADMIN with deny)", () => {
      const ctx: AuthorityContext = {
        role: "ADMIN",
        capabilities: { allow: [], deny: ["view_cost"] },
      };
      // ADMIN normally has view_cost, but member deny overrides
      expect(hasCapability(ctx, "view_cost")).toBe(false);
    });

    it("member allow overrides role default (WORKER with allow)", () => {
      const ctx: AuthorityContext = {
        role: "WORKER",
        capabilities: { allow: ["view_cost"], deny: [] },
      };
      // WORKER normally lacks view_cost, but member allow overrides
      expect(hasCapability(ctx, "view_cost")).toBe(true);
    });

    it("deny wins over allow when both are set", () => {
      const ctx: AuthorityContext = {
        role: "WORKER",
        capabilities: { allow: ["view_cost"], deny: ["view_cost"] },
      };
      // Deny always wins
      expect(hasCapability(ctx, "view_cost")).toBe(false);
    });
  });

  describe("unknown capabilities", () => {
    it("returns false for unknown capability (deny by default)", () => {
      const ctx: AuthorityContext = {
        role: "OWNER",
        capabilities: { allow: [], deny: [] },
      };
      expect(hasCapability(ctx, "unknown_capability")).toBe(false);
    });
  });
});

// =============================================================================
// omitCostFields TESTS
// =============================================================================

describe("omitCostFields", () => {
  describe("with view_cost capability", () => {
    const ctxWithCost: AuthorityContext = {
      role: "ADMIN",
      capabilities: { allow: [], deny: [] },
    };

    it("returns data unchanged when user has view_cost", () => {
      const result = omitCostFields(sampleLineItem, ctxWithCost);
      expect(result).toEqual(sampleLineItem);
    });

    it("nested data is unchanged when user has view_cost", () => {
      const result = omitCostFields(sampleQuoteResponse, ctxWithCost);
      expect(result).toEqual(sampleQuoteResponse);
    });
  });

  describe("without view_cost capability", () => {
    const ctxNoCost: AuthorityContext = {
      role: "WORKER",
      capabilities: { allow: [], deny: [] },
    };

    it("nulls cost-class fields in flat object", () => {
      const result = omitCostFields(sampleLineItem, ctxNoCost);

      // Cost fields should be null
      expect(result.unitCost).toBeNull();
      expect(result.cost).toBeNull();
      expect(result.margin).toBeNull();
      expect(result.markup).toBeNull();
      expect(result.profit).toBeNull();

      // Non-cost fields should be preserved
      expect(result.id).toBe("li_001");
      expect(result.description).toBe("Widget Installation");
      expect(result.quantity).toBe(5);
      expect(result.total).toBe(625); // Customer-facing total is NOT cost
    });

    it("response shape is stable (all keys present)", () => {
      const result = omitCostFields(sampleLineItem, ctxNoCost);

      // All keys should still exist
      expect(Object.keys(result).sort()).toEqual(
        Object.keys(sampleLineItem).sort()
      );
    });

    it("nulls cost fields in nested structures", () => {
      const result = omitCostFields(sampleQuoteResponse, ctxNoCost);

      // Top-level cost fields should be null
      expect(result.costTotal).toBeNull();
      expect(result.internalTotal).toBeNull();
      expect(result.grossProfit).toBeNull();

      // Nested line item cost fields should be null
      expect(result.lineItems[0].unitCost).toBeNull();
      expect(result.lineItems[0].cost).toBeNull();
      expect(result.lineItems[0].margin).toBeNull();

      // Non-cost data should be preserved
      expect(result.id).toBe("quote_001");
      expect(result.status).toBe("draft");
      expect(result.customer.name).toBe("Acme Corp");
      expect(result.subtotal).toBe(625);
      expect(result.total).toBe(625);
      expect(result.lineItems[0].quantity).toBe(5);
    });

    it("handles arrays correctly", () => {
      const items = [sampleLineItem, sampleLineItem];
      const result = omitCostFields(items, ctxNoCost);

      expect(result).toHaveLength(2);
      expect(result[0].cost).toBeNull();
      expect(result[1].cost).toBeNull();
      expect(result[0].quantity).toBe(5);
    });

    it("handles null and undefined safely", () => {
      expect(omitCostFields(null, ctxNoCost)).toBeNull();
      expect(omitCostFields(undefined, ctxNoCost)).toBeUndefined();
    });

    it("handles primitives safely", () => {
      expect(omitCostFields(42, ctxNoCost)).toBe(42);
      expect(omitCostFields("hello", ctxNoCost)).toBe("hello");
      expect(omitCostFields(true, ctxNoCost)).toBe(true);
    });
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("parseCapabilities", () => {
  it("parses valid capabilities object", () => {
    const raw = { allow: ["view_cost"], deny: ["other"] };
    const result = parseCapabilities(raw);
    expect(result).toEqual({ allow: ["view_cost"], deny: ["other"] });
  });

  it("returns defaults for null", () => {
    const result = parseCapabilities(null);
    expect(result).toEqual({ allow: [], deny: [] });
  });

  it("returns defaults for invalid types", () => {
    expect(parseCapabilities("invalid")).toEqual({ allow: [], deny: [] });
    expect(parseCapabilities(123)).toEqual({ allow: [], deny: [] });
    expect(parseCapabilities(undefined)).toEqual({ allow: [], deny: [] });
  });

  it("filters non-string values from arrays", () => {
    const raw = { allow: ["valid", 123, null], deny: ["also_valid", {}] };
    const result = parseCapabilities(raw);
    expect(result).toEqual({ allow: ["valid"], deny: ["also_valid"] });
  });
});

describe("buildAuthorityContext", () => {
  it("builds context from member record", () => {
    const member = {
      role: "MANAGER" as const,
      capabilities: { allow: ["view_cost"], deny: [] },
    };
    const ctx = buildAuthorityContext(member);
    expect(ctx.role).toBe("MANAGER");
    expect(ctx.capabilities).toEqual({ allow: ["view_cost"], deny: [] });
  });
});

// =============================================================================
// PROOF: Cost omission in realistic scenario
// =============================================================================

describe("PROOF: Cost visibility control", () => {
  const adminCtx = buildAuthorityContext({
    role: "ADMIN",
    capabilities: { allow: [], deny: [] },
  });

  const workerCtx = buildAuthorityContext({
    role: "WORKER",
    capabilities: { allow: [], deny: [] },
  });

  const workerWithOverrideCtx = buildAuthorityContext({
    role: "WORKER",
    capabilities: { allow: ["view_cost"], deny: [] },
  });

  it("ADMIN sees full cost data", () => {
    const result = omitCostFields(sampleQuoteResponse, adminCtx);
    expect(result.costTotal).toBe(500);
    expect(result.grossProfit).toBe(125);
    expect(result.lineItems[0].margin).toBe(0.25);
  });

  it("WORKER sees nulled cost data", () => {
    const result = omitCostFields(sampleQuoteResponse, workerCtx);
    expect(result.costTotal).toBeNull();
    expect(result.grossProfit).toBeNull();
    expect(result.lineItems[0].margin).toBeNull();
    // But can still see execution-relevant data
    expect(result.lineItems[0].quantity).toBe(5);
    expect(result.lineItems[0].description).toBe("Widget Installation");
  });

  it("WORKER with override sees full cost data", () => {
    const result = omitCostFields(sampleQuoteResponse, workerWithOverrideCtx);
    expect(result.costTotal).toBe(500);
    expect(result.grossProfit).toBe(125);
    expect(result.lineItems[0].margin).toBe(0.25);
  });
});
