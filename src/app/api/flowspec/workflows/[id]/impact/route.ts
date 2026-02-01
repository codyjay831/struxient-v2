import { NextRequest, NextResponse } from "next/server";
import { computePublishImpact } from "@/lib/flowspec/analysis";
import type { WorkflowSnapshot } from "@/lib/flowspec/types";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";

/**
 * POST /api/flowspec/workflows/[id]/impact
 * Computes the impact of publishing a draft workflow.
 * 
 * This is a READ-ONLY analysis endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await verifyTenantOwnership("Workflow", id);

    const body = await request.json();
    const draftSnapshot = body.snapshot as WorkflowSnapshot;

    if (!draftSnapshot) {
      return NextResponse.json(
        { error: "Missing draft snapshot" },
        { status: 400 }
      );
    }

    // Impact analysis with a 5-second timeout (conceptually)
    const analysisPromise = computePublishImpact(id, draftSnapshot);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), 5000)
    );

    try {
      const report = await Promise.race([analysisPromise, timeoutPromise]);
      return NextResponse.json(report);
    } catch (err) {
      if (err instanceof Error && err.message === "TIMEOUT") {
        return NextResponse.json(
          { 
            breakingChanges: [], 
            activeFlowsCount: 0, 
            isAnalysisComplete: false, 
            message: "Impact analysis unavailable (timeout)" 
          },
          { status: 200 } // Still 200 to allow Publish to proceed
        );
      }
      throw err;
    }
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
