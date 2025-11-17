import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";

import connectToDatabase from "@/lib/db";
import { fetchSheetData, type TypedRow } from "@/lib/google-sheets";
import { AppError, isTransactionUnsupportedError, mapToAppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging";
import DeviceModel from "@/models/Device";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";

import {
  normalizeSheetRows,
  type NormalizedDevice,
} from "@/workers/sync/transform";

const compositeKey = (deviceId: string, sheetId: string) =>
  `${deviceId.toLowerCase()}::${sheetId.toLowerCase()}`;

export type UpsertSummary = {
  added: number;
  updated: number;
  unchanged: number;
  durationMs: number;
  runId: string;
  anomalies: string[];
};

type SyncTriggerContext = {
  type: "manual" | "scheduled" | "system";
  requestedBy?: string | null;
  anonymized?: boolean;
  queueLatencyMs?: number;
};

export type { SyncTriggerContext };

type ApplyDeviceUpsertsOptions = {
  sheetId: string;
  requestId?: string;
  runId?: string;
  anomalies?: string[];
  trigger?: SyncTriggerContext;
  rowCount?: number;
  durationMs?: number;
  skipSyncEvent?: boolean;
};

const writeSyncEvent = async (
  payload: {
    eventType: SyncEventType;
    route: string;
    method: string;
    reason?: string;
    requestId?: string;
    ip?: string;
    userEmail?: string | null;
    metadata?: Record<string, unknown>;
  },
  session?: ClientSession
) => {
  if (session) {
    await SyncEventModel.create(payload, { session });
    return;
  }
  await SyncEventModel.create(payload);
};

export const applyDeviceUpserts = async (
  devices: NormalizedDevice[],
  options: ApplyDeviceUpsertsOptions
): Promise<UpsertSummary> => {
  const started = Date.now();
  const runId = options.runId ?? randomUUID();

  if (devices.length === 0) {
    logger.info(
      {
        event: "DEVICE_SYNC_NOOP",
        sheetId: options.sheetId,
        runId,
        anomalies: options.anomalies ?? [],
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
      },
      "No devices to upsert"
    );
    if (!options.skipSyncEvent) {
      await writeSyncEvent(
        {
          eventType: "SYNC_RUN",
          route: "workers/sync",
          method: "TASK",
          requestId: options.requestId,
          metadata: {
            sheetId: options.sheetId,
            runId,
            added: 0,
            updated: 0,
            unchanged: 0,
            anomalies: options.anomalies ?? [],
            trigger: options.trigger?.type ?? "system",
            requestedBy: options.trigger?.requestedBy ?? null,
            anonymized: options.trigger?.anonymized ?? false,
            rowCount: options.rowCount ?? 0,
            status: "success",
            durationMs: options.durationMs ?? 0,
            queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
          },
        },
        session ?? undefined
      );
    }

    return {
      added: 0,
      updated: 0,
      unchanged: 0,
      durationMs: Date.now() - started,
      runId,
      anomalies: options.anomalies ?? [],
    };
  }

  const executeUpserts = async (session?: ClientSession): Promise<UpsertSummary> => {
    const existingDocs = await DeviceModel.find({
      sheetId: options.sheetId,
      deviceId: { $in: devices.map((device) => device.deviceId) },
    })
      .session(session ?? undefined)
      .lean();

    const existingMap = new Map(
      existingDocs.map((doc) => [compositeKey(doc.deviceId, doc.sheetId), doc])
    );

    const seenKeys = new Set<string>();
    const duplicateRows: string[] = [];

    const operations: Parameters<typeof DeviceModel.bulkWrite>[0] = [];
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    for (const device of devices) {
      const key = compositeKey(device.deviceId, device.sheetId);
      if (seenKeys.has(key)) {
        duplicateRows.push(
          `Duplicate row detected for ${device.deviceId} in sheet ${device.sheetId}`
        );
        continue;
      }
      seenKeys.add(key);

      const existing = existingMap.get(key);
      if (!existing) {
        added += 1;
        operations.push({
          updateOne: {
            filter: { deviceId: device.deviceId, sheetId: device.sheetId },
            update: {
              $set: {
                assignedTo: device.assignedTo,
                status: device.status,
                condition: device.condition,
                offboardingStatus: device.offboardingStatus ?? null,
                lastSeen: device.lastSeen ?? null,
                lastSyncedAt: device.lastSyncedAt,
                contentHash: device.contentHash,
              },
            },
            upsert: true,
          },
        });
        continue;
      }

      if (existing.contentHash === device.contentHash) {
        unchanged += 1;
        continue;
      }

      updated += 1;
      operations.push({
        updateOne: {
          filter: { deviceId: device.deviceId, sheetId: device.sheetId },
          update: {
            $set: {
              assignedTo: device.assignedTo,
              status: device.status,
              condition: device.condition,
              offboardingStatus: device.offboardingStatus ?? null,
              lastSeen: device.lastSeen ?? null,
              lastSyncedAt: device.lastSyncedAt,
              contentHash: device.contentHash,
            },
          },
          upsert: false,
        },
      });
    }

    if (operations.length > 0) {
      await DeviceModel.bulkWrite(operations, { ordered: false, session: session ?? undefined });
    }

    const anomalies = [...(options.anomalies ?? []), ...duplicateRows];
    const durationMs = Date.now() - started;

    logger.info(
      {
        event: "DEVICE_SYNC_SUMMARY",
        sheetId: options.sheetId,
        runId,
        added,
        updated,
        unchanged,
        durationMs,
        anomalies,
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
      },
      "Device sync upsert phase completed"
    );

    if (!options.skipSyncEvent) {
      await writeSyncEvent(
        {
          eventType: "SYNC_RUN",
          route: "workers/sync",
          method: "TASK",
          requestId: options.requestId,
          metadata: {
            sheetId: options.sheetId,
            runId,
            added,
            updated,
            unchanged,
            anomalies,
            trigger: options.trigger?.type ?? "system",
            requestedBy: options.trigger?.requestedBy ?? null,
            anonymized: options.trigger?.anonymized ?? false,
            rowCount: options.rowCount ?? devices.length,
            status: "success",
            durationMs: options.durationMs ?? durationMs,
            queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
          },
        },
        session ?? undefined
      );
    }

    return {
      added,
      updated,
      unchanged,
      durationMs,
      runId,
      anomalies,
    };
  };

  type DeviceSnapshot = Array<{
    deviceId: string;
    sheetId: string;
    assignedTo: string;
    status: string;
    condition: string;
    offboardingStatus?: string | null;
    lastSeen?: Date | null;
    lastSyncedAt: Date;
    contentHash: string;
    createdAt?: Date;
    updatedAt?: Date;
    _id?: unknown;
  }>;

  const restoreSnapshot = async (snapshot: DeviceSnapshot) => {
    await DeviceModel.deleteMany({ sheetId: options.sheetId });
    if (snapshot.length === 0) {
      return;
    }
    await DeviceModel.insertMany(snapshot, { ordered: false });
  };

  const attemptWithTransaction = async () => {
    const session = await mongoose.startSession();
    try {
      let summary: UpsertSummary | undefined;
      await session.withTransaction(async () => {
        summary = await executeUpserts(session);
      });
      if (!summary) {
        throw new AppError({
          code: "MONGO_WRITE_FAILED",
          message: "Sync transaction completed without summary payload",
        });
      }
      return summary;
    } finally {
      await session.endSession();
    }
  };

  try {
    return await attemptWithTransaction();
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      logger.warn(
        {
          event: "DEVICE_SYNC_TRANSACTION_FALLBACK",
          sheetId: options.sheetId,
        },
        "MongoDB transactions are unavailable, falling back to snapshot guard"
      );
      const snapshot = (await DeviceModel.find({ sheetId: options.sheetId }).lean()) as DeviceSnapshot;
      try {
        return await executeUpserts();
      } catch (fallbackError) {
        logger.error(
          {
            event: "DEVICE_SYNC_FALLBACK_FAILED",
            sheetId: options.sheetId,
            error: fallbackError,
          },
          "Snapshot-guarded upsert failed; attempting rollback"
        );
        try {
          await restoreSnapshot(snapshot);
        } catch (restoreError) {
          logger.error(
            {
              event: "DEVICE_SYNC_ROLLBACK_FAILURE",
              sheetId: options.sheetId,
              restoreError,
            },
            "Failed to restore snapshot after sync failure"
          );
        }
        throw mapToAppError(fallbackError, "MONGO_WRITE_FAILED");
      }
    }
    throw mapToAppError(error, "MONGO_WRITE_FAILED");
  }
};

type RunDeviceSyncOptions = {
  sheetId: string;
  tabName?: string;
  requestId?: string;
  overrideRows?: TypedRow[];
  trigger?: SyncTriggerContext;
  runId?: string;
};

export type RunDeviceSyncResult = {
  sheetId: string;
  rowCount: number;
  skipped: number;
  anomalies: string[];
  upsert: UpsertSummary;
  durationMs: number;
};

export const runDeviceSync = async (
  options: RunDeviceSyncOptions
): Promise<RunDeviceSyncResult> => {
  await connectToDatabase();

  const startedAt = Date.now();
  const fetchStart = Date.now();
  const rows =
    options.overrideRows ??
    (await fetchSheetData({
      sheetId: options.sheetId,
      tabName: options.tabName ?? "Devices",
      requestId: options.requestId,
    })).rows;
  const fetchDuration = Date.now() - fetchStart;

  logger.debug(
    {
      event: "DEVICE_SYNC_FETCH",
      sheetId: options.sheetId,
      durationMs: fetchDuration,
      rowCount: rows.length,
    },
    "Fetched Google Sheets rows"
  );

  const normalization = normalizeSheetRows(rows, {
    sheetId: options.sheetId,
  });

  const upsert = await applyDeviceUpserts(normalization.devices, {
    sheetId: options.sheetId,
    requestId: options.requestId,
    anomalies: normalization.anomalies,
    trigger: options.trigger,
    runId: options.runId,
    rowCount: normalization.rowCount,
    durationMs: undefined,
    skipSyncEvent: true,
  });

  const totalDurationMs = Date.now() - startedAt;

  logger.info(
    {
      event: "DEVICE_SYNC_COMPLETED",
      sheetId: options.sheetId,
      runId: upsert.runId,
      rowCount: normalization.rowCount,
      skipped: normalization.skipped,
      durationMs: totalDurationMs,
      trigger: options.trigger?.type ?? "system",
      requestedBy: options.trigger?.requestedBy ?? null,
      anonymized: options.trigger?.anonymized ?? false,
    },
    "Device sync pipeline completed"
  );

  await writeSyncEvent({
    eventType: "SYNC_RUN",
    route: "workers/sync",
    method: "TASK",
    requestId: options.requestId,
    metadata: {
      sheetId: options.sheetId,
      runId: upsert.runId,
      added: upsert.added,
      updated: upsert.updated,
      unchanged: upsert.unchanged,
      anomalies: upsert.anomalies,
      trigger: options.trigger?.type ?? "system",
      requestedBy: options.trigger?.requestedBy ?? null,
      anonymized: options.trigger?.anonymized ?? false,
      rowCount: normalization.rowCount,
      skipped: normalization.skipped,
      status: "success",
      durationMs: totalDurationMs,
      queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
    },
  });

  return {
    sheetId: options.sheetId,
    rowCount: normalization.rowCount,
    skipped: normalization.skipped,
    anomalies: upsert.anomalies,
    upsert,
    durationMs: totalDurationMs,
  };
};
