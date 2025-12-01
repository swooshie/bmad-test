import { NextResponse } from "next/server";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import { ensureRuntimeConfig } from "@/lib/config";
import connectToDatabase from "@/lib/db";
import { AppError, mapToAppError, serializeAppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging";
import { runSerialAudit } from "@/workers/sync/audit";

const errorResponse = (error: AppError) =>
  NextResponse.json(
    {
      data: null,
      error: serializeAppError(error),
    },
    { status: error.httpStatus }
  );

export const POST = withSession(async (request: NextRequestWithSession) => {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const actorEmail = request.session.user?.email ?? null;

  let runtimeConfig;
  try {
    runtimeConfig = await ensureRuntimeConfig();
  } catch (error) {
    const mapped = mapToAppError(error, "CONFIG_MISSING");
    logger.error(
      { event: "SERIAL_AUDIT_CONFIG_ERROR", requestId, referenceId: mapped.referenceId, error },
      "Serial audit dry-run failed to load runtime configuration"
    );
    return errorResponse(mapped);
  }

  const sheetId = runtimeConfig.config.devicesSheetId;
  if (!sheetId) {
    const configError = new AppError({
      code: "INVALID_SYNC_CONFIGURATION",
      message: "devicesSheetId is missing. Seed configuration before running audits.",
      httpStatus: 503,
    });
    logger.error(
      { event: "SERIAL_AUDIT_SHEET_MISSING", requestId, referenceId: configError.referenceId },
      "Serial audit dry-run cannot proceed without a configured sheet ID"
    );
    return errorResponse(configError);
  }

  await connectToDatabase();

  try {
    const audit = await runSerialAudit({
      sheetId,
      tabName: "Devices",
      requestId,
      trigger: {
        type: "manual",
        requestedBy: actorEmail,
        anonymized: false,
      },
      mode: "dry-run",
      source: {
        route: "/api/sync/audit",
        method: "POST",
      },
    });

    logger.info(
      {
        event: "SERIAL_AUDIT_DRY_RUN",
        sheetId,
        rowsAudited: audit.rowsAudited,
        missingSerialCount: audit.missingSerialCount,
        actor: actorEmail,
        requestId,
      },
      "Serial audit dry-run completed"
    );

    return NextResponse.json(
      {
        data: audit,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const mapped = error instanceof AppError ? error : mapToAppError(error, "UNKNOWN_FAILURE");
    logger.error(
      {
        event: "SERIAL_AUDIT_DRY_RUN_FAILED",
        sheetId,
        requestId,
        referenceId: mapped.referenceId,
        error,
      },
      "Serial audit dry-run failed"
    );
    return errorResponse(mapped);
  }
});
