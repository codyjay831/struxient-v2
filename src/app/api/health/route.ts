import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Required for request-specific operations
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
