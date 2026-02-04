/**
 * API Utilities
 *
 * Canon Source: 50_flowspec_builder_ui_api_map.md §6
 */

import { NextResponse } from "next/server";
import { omitCostFields, type AuthorityContext } from "./auth/capabilities";

/**
 * Success response with standardized timestamp and optional data shaping.
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  authority?: AuthorityContext
) {
  const finalData = authority ? omitCostFields(data, authority) : data;

  return NextResponse.json(
    {
      ...(finalData as object),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Error response with standardized format.
 */
export function apiError(
  code: string,
  message: string,
  details: any = null,
  status: number = 400
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * List response with pagination and optional data shaping.
 */
export function apiList<T>(
  items: T[],
  total: number,
  offset: number = 0,
  limit: number = 100,
  authority?: AuthorityContext
) {
  return apiSuccess(
    {
      items,
      pagination: {
        total,
        offset,
        limit,
      },
    },
    200,
    authority
  );
}

/**
 * Centralized API Route Error Handler.
 * Handles TenantIsolationError, Prisma errors, and generic fallbacks.
 */
export function apiRouteError(error: any) {
  // 1. Tenant/Auth Isolation Errors
  if (error.name === "TenantIsolationError") {
    const isNoMembership = error.message === "User has no company membership";
    return apiError(
      isNoMembership ? "NO_MEMBERSHIP" : "FORBIDDEN",
      error.message,
      null,
      403
    );
  }

  // 2. Prisma Known Request Errors
  if (error.code === "P2002") {
    return apiError("CONFLICT", "Resource already exists", error.meta, 409);
  }
  if (error.code === "P2025") {
    return apiError("NOT_FOUND", "Resource not found", error.meta, 404);
  }

  // 3. Prisma Validation / Schema Mismatch
  if (error.message?.includes("Unknown argument") || error.code?.startsWith("P")) {
    return apiError(
      "INTERNAL_SERVER_ERROR",
      process.env.NODE_ENV === "development" ? error.message : "A database error occurred",
      error.code,
      500
    );
  }

  // 4. Generic Fallback
  return apiError(
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred",
    process.env.NODE_ENV === "development" ? error.message : null,
    500
  );
}
