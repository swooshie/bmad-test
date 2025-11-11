import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import { ensureRuntimeConfig, RuntimeConfigError } from "@/lib/config";
import { SheetFetchError } from "@/lib/google-sheets";
import { logger } from "@/lib/logging";
import {
  markSyncError,
  markSyncRunning,
  markSyncSuccess,
} from "@/lib/sync-status";
import { runDeviceSync, type SyncTriggerContext } from "@/workers/sync";

const errorResponse = (status: number, errorCode: string, message: string) =>
  NextResponse.json(
    {
      data: null,
      error: { code: errorCode, message },
    },
    { status }
  );

const mapSyncError = (error: unknown) => {
  if (error instanceof SheetFetchError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "SYNC_FAILED", message: error.message };
  }
  return { code: "SYNC_FAILED", message: "Unknown sync failure" };
};

export const POST = withSession(async (request: NextRequestWithSession) => {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const managerEmail = request.session.user?.email ?? null;

  let runtimeConfig;
  try {
    runtimeConfig = await ensureRuntimeConfig();
  } catch (error) {
    const message =
      error instanceof RuntimeConfigError
        ? error.message
        : "Unable to load runtime configuration";
    logger.error(
      { event: "MANUAL_SYNC_CONFIG_ERROR", requestId, error },
      "Manual sync failed to load configuration"
    );
    return errorResponse(503, "CONFIG_MISSING", message);
  }

  const sheetId = runtimeConfig.config.devicesSheetId;
  if (!sheetId) {
    logger.error(
      { event: "MANUAL_SYNC_SHEET_MISSING", requestId },
      "devicesSheetId missing from configuration"
    );
    return errorResponse(
      503,
      "SHEET_ID_MISSING",
      "devicesSheetId was not defined. Seed configuration before syncing."
    );
  }

  const runId = randomUUID();
  const triggerContext: SyncTriggerContext = {
    type: "manual",
    requestedBy: managerEmail,
    anonymized: false,
    queueLatencyMs: 0,
  };

  markSyncRunning({
    runId,
    requestedBy: managerEmail,
  });

  void runDeviceSync({
    sheetId,
    requestId,
    trigger: triggerContext,
    runId,
  })
    .then((result) => {
      markSyncSuccess({
        runId,
        metrics: {
          added: result.upsert.added,
          updated: result.upsert.updated,
          unchanged: result.upsert.unchanged,
          durationMs: result.durationMs,
        },
      });
    })
    .catch((error) => {
      const mapped = mapSyncError(error);
      logger.error(
        {
          event: "MANUAL_SYNC_FAILURE",
          runId,
          sheetId,
          requestId,
          errorCode: mapped.code,
          error,
        },
        "Manual sync run failed"
      );
      markSyncError({
        runId,
        errorCode: mapped.code,
        message: mapped.message,
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
