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
