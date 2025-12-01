import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import { ensureRuntimeConfig } from "@/lib/config";
import connectToDatabase from "@/lib/db";
import { recordAuditLogFromSyncEvent } from "@/lib/audit/auditLogs";
import { SheetFetchError } from "@/lib/google-sheets";
import { AppError, mapToAppError, serializeAppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging";
import {
  markSyncError,
  markSyncRunning,
  markSyncSuccess,
} from "@/lib/sync-status";
import SyncEventModel from "@/models/SyncEvent";
import { runDeviceSync, type SyncTriggerContext } from "@/workers/sync";

const errorResponse = (error: AppError) =>
  NextResponse.json(
    {
      data: null,
      error: serializeAppError(error),
    },
    { status: error.httpStatus }
  );

const recordManualSyncFailure = async (payload: {
  runId: string;
  requestId?: string;
  sheetId: string;
  error: AppError;
  managerEmail: string | null;
}) => {
  await connectToDatabase();
  await SyncEventModel.create({
    eventType: "SYNC_RUN",
    route: "/api/sync/manual",
    method: "POST",
    requestId: payload.requestId,
    metadata: {
      runId: payload.runId,
      sheetId: payload.sheetId,
      trigger: "manual",
      requestedBy: payload.managerEmail,
      status: "failed",
      errorCode: payload.error.code,
      recommendation: payload.error.recommendation,
      referenceId: payload.error.referenceId,
    },
  });

  await recordAuditLogFromSyncEvent({
    eventType: "SYNC_RUN",
    action: "MANUAL_SYNC_FAILED",
    actor: payload.managerEmail,
    status: "error",
    errorCode: payload.error.code,
    context: {
      runId: payload.runId,
      sheetId: payload.sheetId,
      requestId: payload.requestId,
      recommendation: payload.error.recommendation,
      referenceId: payload.error.referenceId,
    },
  });
};

export const POST = withSession(async (request: NextRequestWithSession) => {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const managerEmail = request.session.user?.email ?? null;
  let requestedMode: "live" | "dry-run" | undefined;
  try {
    const body = (await request.json()) as { mode?: "live" | "dry-run" } | undefined;
    requestedMode = body?.mode;
  } catch {
    requestedMode = undefined;
  }

  let runtimeConfig;
  try {
    runtimeConfig = await ensureRuntimeConfig();
  } catch (error) {
    const mapped = mapToAppError(error, "CONFIG_MISSING");
    logger.error(
      {
        event: "MANUAL_SYNC_CONFIG_ERROR",
        requestId,
        referenceId: mapped.referenceId,
        error,
      },
      "Manual sync failed to load configuration"
    );
    return errorResponse(mapped);
  }

  const sheetId = runtimeConfig.config.devicesSheetId;
  if (!sheetId) {
    const appError = new AppError({
      code: "INVALID_SYNC_CONFIGURATION",
      message: "devicesSheetId was not defined. Seed configuration before syncing.",
      httpStatus: 503,
    });
    logger.error(
      {
        event: "MANUAL_SYNC_SHEET_MISSING",
        requestId,
        referenceId: appError.referenceId,
      },
      "devicesSheetId missing from configuration"
    );
    return errorResponse(appError);
  }

  const runId = randomUUID();
  const triggerContext: SyncTriggerContext = {
    type: "manual",
    requestedBy: managerEmail,
    anonymized: false,
    queueLatencyMs: 0,
    mode: requestedMode ?? "live",
  };

  markSyncRunning({
    runId,
    requestedBy: managerEmail,
    trigger: triggerContext.type,
    mode: triggerContext.mode,
  });
  logger.info(
    {
      event: "MANUAL_SYNC_TRIGGERED",
      runId,
      sheetId,
      requestId,
      requestedBy: managerEmail ?? "unknown",
    },
    "Manual sync requested from authenticated shell"
  );

  void runDeviceSync({
    sheetId,
    requestId,
    trigger: triggerContext,
    runId,
    mode: triggerContext.mode,
  })
    .then((result) => {
      markSyncSuccess({
        runId,
        requestedBy: managerEmail,
        trigger: triggerContext.type,
        mode: triggerContext.mode,
        metrics: {
          added: result.upsert.added,
          updated: result.upsert.updated,
          unchanged: result.upsert.unchanged,
        rowsProcessed: result.rowCount,
          rowsSkipped: result.skipped,
          conflicts: result.upsert.serialConflicts,
          durationMs: result.durationMs,
          serialConflicts: result.upsert.serialConflicts,
        legacyIdsUpdated: result.upsert.legacyIdsUpdated,
        columnsAdded: result.columnRegistry?.added ?? 0,
        columnsRemoved: result.columnRegistry?.removed ?? 0,
        columnTotal: result.columnRegistry?.total ?? 0,
        columnsVersion: result.columnRegistryVersion,
      },
      schemaChange: result.schemaChange
        ? {
            added: result.schemaChange.added,
            removed: result.schemaChange.removed,
            renamed: result.schemaChange.renamed.map((pair) => `${pair.from} -> ${pair.to}`),
            currentVersion: result.schemaChange.currentVersion,
            previousVersion: result.schemaChange.previousVersion,
          }
        : undefined,
    });
  })
    .catch(async (error) => {
      const mapped =
        error instanceof SheetFetchError
          ? mapToAppError(error)
          : mapToAppError(error, "MONGO_WRITE_FAILED");
      logger.error(
        {
          event: "MANUAL_SYNC_FAILURE",
          runId,
          sheetId,
          requestId,
          errorCode: mapped.code,
          referenceId: mapped.referenceId,
          error,
        },
        "Manual sync run failed"
      );
      markSyncError({
        runId,
        requestedBy: managerEmail,
        trigger: triggerContext.type,
        mode: triggerContext.mode,
        errorCode: mapped.code,
        message: mapped.message,
        recommendation: mapped.recommendation,
        referenceId: mapped.referenceId,
      });
      await recordManualSyncFailure({
        runId,
        requestId,
        sheetId,
        error: mapped,
        managerEmail,
      });
    });

  return NextResponse.json(
    {
      data: {
        runId,
        status: "running",
        requestedBy: managerEmail,
        sheetId,
        queuedAt: new Date().toISOString(),
      },
      error: null,
    },
    { status: 202 }
  );
});
