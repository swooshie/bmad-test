import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import connectToDatabase from "@/lib/db";
import { ensureRuntimeConfig } from "@/lib/config";
import { SheetFetchError } from "@/lib/google-sheets";
import { AppError, mapToAppError, serializeAppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging";
import {
  markSyncError,
  markSyncRunning,
  markSyncSuccess,
} from "@/lib/sync-status";
import { acquireSyncLock, releaseSyncLock } from "@/lib/sync-lock";
import SyncEventModel from "@/models/SyncEvent";
import { runDeviceSync, type SyncTriggerContext } from "@/workers/sync";

const CRON_HEADER = "x-appengine-cron";
const TOKEN_HEADER = "x-internal-service-token";
const SCHEDULER_ACTOR = "scheduler";

const errorResponse = (error: AppError) =>
  NextResponse.json(
    {
      data: null,
      error: serializeAppError(error),
    },
    { status: error.httpStatus }
  );

const recordScheduledSkip = async (reason: string, metadata?: Record<string, unknown>) => {
  await connectToDatabase();
  await SyncEventModel.create({
    eventType: "SYNC_RUN",
    route: "/api/sync/run",
    method: "POST",
    reason,
    metadata: {
      trigger: "scheduled",
      status: "skipped",
      reason,
      ...metadata,
    },
  });
};

const recordFailureEvent = async (payload: {
  runId: string;
  requestId?: string;
  sheetId: string;
  error: AppError;
}) => {
  await connectToDatabase();
  await SyncEventModel.create({
    eventType: "SYNC_RUN",
    route: "/api/sync/run",
    method: "POST",
    requestId: payload.requestId,
    metadata: {
      trigger: "scheduled",
      status: "failed",
      runId: payload.runId,
      sheetId: payload.sheetId,
      errorCode: payload.error.code,
      recommendation: payload.error.recommendation,
      referenceId: payload.error.referenceId,
    },
  });
};

export const POST = async (request: NextRequest) => {
  const providedRequestId = request.headers.get("x-request-id") ?? undefined;
  const requestId = providedRequestId ?? randomUUID();
  const requestStartedAt = Date.now();

  let runtimeConfig;
  try {
    runtimeConfig = await ensureRuntimeConfig();
  } catch (error) {
    const mapped = mapToAppError(error, "CONFIG_MISSING");
    logger.error(
      { event: "CRON_SYNC_CONFIG_ERROR", requestId, referenceId: mapped.referenceId, error },
      "Scheduled sync failed to load configuration"
    );
    return errorResponse(mapped);
  }

  const schedulerToken = runtimeConfig.secrets.syncSchedulerToken;
  if (!schedulerToken) {
    const error = new AppError({
      code: "CONFIG_MISSING",
      message: "Sync scheduler token is not configured",
      httpStatus: 503,
    });
    logger.error(
      { event: "CRON_SYNC_TOKEN_MISSING", requestId, referenceId: error.referenceId },
      "Sync scheduler secret was not configured"
    );
    return errorResponse(error);
  }

  const cronHeader = request.headers.get(CRON_HEADER);
  const providedToken = request.headers.get(TOKEN_HEADER);
  if (cronHeader !== "true" || !providedToken || providedToken !== schedulerToken) {
    const error = new AppError({
      code: "UNAUTHORIZED_CRON",
      message: "Scheduler headers were missing or invalid",
      httpStatus: 401,
    });
    logger.warn(
      { event: "CRON_SYNC_UNAUTHORIZED", requestId, referenceId: error.referenceId },
      "Rejected scheduled sync: missing or invalid scheduler headers"
    );
    return errorResponse(error);
  }

  const sheetId = runtimeConfig.config.devicesSheetId;
  if (!sheetId) {
    const error = new AppError({
      code: "INVALID_SYNC_CONFIGURATION",
      message: "devicesSheetId was not defined. Seed configuration before syncing.",
      httpStatus: 503,
    });
    logger.error(
      { event: "CRON_SYNC_SHEET_MISSING", requestId, referenceId: error.referenceId },
      "devicesSheetId missing from configuration"
    );
    return errorResponse(error);
  }

  const syncSettings = runtimeConfig.config.sync ?? {
    enabled: true,
    intervalMinutes: 2,
    timezone: "Etc/UTC",
  };

  if (!syncSettings.enabled) {
    logger.warn(
      { event: "CRON_SYNC_DISABLED", requestId },
      "Scheduled sync skipped because sync.enabled=false"
    );
    await recordScheduledSkip("config_disabled", { requestId });
    return NextResponse.json(
      {
        data: { status: "skipped", reason: "config_disabled" },
        error: null,
      },
      { status: 202 }
    );
  }

  await connectToDatabase();
  const lastScheduledRun = await SyncEventModel.findOne({
    eventType: "SYNC_RUN",
    "metadata.trigger": "scheduled",
    "metadata.status": { $ne: "skipped" },
  })
    .sort({ createdAt: -1 })
    .lean();

  const now = Date.now();
  const minIntervalMs = Math.max(syncSettings.intervalMinutes, 1) * 60_000;

  if (lastScheduledRun) {
    const elapsed = now - new Date(lastScheduledRun.createdAt).getTime();
    if (elapsed < minIntervalMs) {
      const remainingMs = minIntervalMs - elapsed;
      logger.warn(
        {
          event: "CRON_SYNC_CADENCE_SKIPPED",
          requestId,
          elapsedMs: elapsed,
          remainingMs,
        },
        "Scheduled sync skipped because cadence window not met"
      );
      await recordScheduledSkip("cadence_window", {
        elapsedMs: elapsed,
        remainingMs,
        lastRunAt: lastScheduledRun.createdAt,
      });
      return NextResponse.json(
        {
          data: {
            status: "skipped",
            reason: "cadence_window",
            metadata: { remainingMs },
          },
          error: null,
        },
        { status: 202 }
      );
    }
  }

  const lockId = randomUUID();
  const lockResult = await acquireSyncLock({ lockId, ttlMs: minIntervalMs });
  if (!lockResult.acquired) {
    logger.warn(
      {
        event: "CRON_SYNC_INFLIGHT",
        requestId,
        lockedAt: lockResult.lock?.lockedAt,
      },
      "Scheduled sync skipped because previous run is still in-flight"
    );
    await recordScheduledSkip("inflight", {
      lockedAt: lockResult.lock?.lockedAt ?? null,
      lockId: lockResult.lock?.lockId ?? null,
    });
    return NextResponse.json(
      {
        data: { status: "skipped", reason: "inflight" },
        error: null,
      },
      { status: 202 }
    );
  }

  const runId = randomUUID();
  const triggerContext: SyncTriggerContext = {
    type: "scheduled",
    requestedBy: SCHEDULER_ACTOR,
    anonymized: false,
    queueLatencyMs: Date.now() - requestStartedAt,
  };

  markSyncRunning({
    runId,
    requestedBy: SCHEDULER_ACTOR,
  });

  const executeScheduledSync = async () => {
    try {
      const result = await runDeviceSync({
        sheetId,
        requestId,
        trigger: triggerContext,
        runId,
      });

      markSyncSuccess({
        runId,
        metrics: {
          added: result.upsert.added,
          updated: result.upsert.updated,
          unchanged: result.upsert.unchanged,
          durationMs: result.durationMs,
        },
      });
    } catch (error) {
      const mapped =
        error instanceof SheetFetchError
          ? mapToAppError(error)
          : mapToAppError(error, "MONGO_WRITE_FAILED");
      logger.error(
        {
          event: "CRON_SYNC_FAILURE",
          runId,
          sheetId,
          requestId,
          errorCode: mapped.code,
          referenceId: mapped.referenceId,
          error,
        },
        "Scheduled sync run failed"
      );
      markSyncError({
        runId,
        errorCode: mapped.code,
        message: mapped.message,
        recommendation: mapped.recommendation,
        referenceId: mapped.referenceId,
      });
      await recordFailureEvent({
        runId,
        requestId,
        sheetId,
        error: mapped,
      });
    } finally {
      try {
        await releaseSyncLock(lockId);
      } catch (releaseError) {
        logger.error(
          { event: "CRON_SYNC_RELEASE_FAILED", lockId, releaseError },
          "Failed to release scheduled sync lock"
        );
      }
    }
  };

  void executeScheduledSync();

  return NextResponse.json(
    {
      data: {
        status: "running",
        trigger: "scheduled",
        runId,
        sheetId,
        requestedBy: SCHEDULER_ACTOR,
        startedAt: new Date().toISOString(),
      },
      error: null,
    },
    { status: 202 }
  );
};
