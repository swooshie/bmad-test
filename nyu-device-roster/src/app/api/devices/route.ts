import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import { logger, logFilterChipUpdate } from "@/lib/logging";
import { anonymizeDeviceRow, readAnonymizationCookie } from "@/lib/anonymization";
import {
  DEFAULT_DEVICE_GRID_STATE,
  mergeDeviceGridState,
  parseDeviceGridSearchParams,
} from "@/lib/devices/grid-query";

import { queryDeviceGrid } from "./device-query-service";
import { recordFilterChipUpdatedEvent } from "@/lib/audit/syncEvents";
import { z } from "zod";

const filterSchema = z.object({
  search: z.string().max(120).optional(),
  status: z.array(z.string()).optional(),
  condition: z.array(z.string()).optional(),
  assignedTo: z.string().max(120).optional(),
  offboardingStatus: z.array(z.string()).optional(),
});

export const GET = withSession(async (request) => {
  const parsedState = parseDeviceGridSearchParams(request.nextUrl.searchParams);
  let queryState = mergeDeviceGridState(DEFAULT_DEVICE_GRID_STATE, parsedState);
  const anonymized = readAnonymizationCookie(request.cookies);
  const requestId = request.headers.get("x-request-id") ?? undefined;

  const filtersValidation = filterSchema.safeParse(queryState.filters);
  if (!filtersValidation.success) {
    return NextResponse.json(
      {
        data: null,
        meta: null,
        error: {
          code: "INVALID_FILTERS",
          message: "Filters are invalid",
        },
      },
      { status: 400 }
    );
  }
  queryState = { ...queryState, filters: filtersValidation.data };

  try {
    let result = await queryDeviceGrid(queryState);

    if (result.meta.total > 0 && queryState.page > result.meta.totalPages) {
      queryState = { ...queryState, page: result.meta.totalPages };
      result = await queryDeviceGrid(queryState);
    }

    logFilterChipUpdate({
      event: "FILTER_CHIP_UPDATED",
      filters: queryState.filters,
      requestId,
      anonymized,
      total: result.meta.total,
    });

    void recordFilterChipUpdatedEvent({
      route: "/api/devices",
      method: "GET",
      filters: queryState.filters,
      total: result.meta.total,
      requestId,
      userEmail: null,
    });

    return NextResponse.json(
      {
        data: {
          devices: anonymized ? result.devices.map((device) => anonymizeDeviceRow(device, true)) : result.devices,
        },
        meta: result.meta,
        error: null,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    logger.error(
      {
        event: "DEVICE_GRID_QUERY_FAILED",
        route: "/api/devices",
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      },
      "Device grid query failed"
    );

    return NextResponse.json(
      {
        data: null,
        meta: null,
        error: {
          code: "DEVICE_GRID_QUERY_FAILED",
          message: "Unable to load devices right now. Please retry in a moment.",
        },
      },
      { status: 500 }
    );
  }
});
