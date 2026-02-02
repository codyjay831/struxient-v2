import { NextRequest, NextResponse } from "next/server";
import { diagnoseFlowStall } from "@/lib/flowspec/analysis";
import { getFlow } from "@/lib/flowspec/engine";
import { verifyTenantOwnership, tenantErrorResponse } from "@/lib/auth/tenant";

/**
 * GET /api/flowspec/flows/[flowId]/diagnosis
 * Diagnoses why a flow is stalled.
 * 
 * This is a READ-ONLY analysis endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params;

    const flow = await getFlow(flowId);
    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    await verifyTenantOwnership(flow.workflow.companyId);

    const diagnosis = await diagnoseFlowStall(flowId);
    
    return NextResponse.json(diagnosis);
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
