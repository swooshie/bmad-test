import { randomUUID } from "node:crypto";

import connectToDatabase from "@/lib/db";
import { fetchSheetData, type TypedRow } from "@/lib/google-sheets";
import { logger } from "@/lib/logging";
import DeviceModel from "@/models/Device";
import SyncEventModel from "@/models/SyncEvent";

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
      await SyncEventModel.create({
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
      });
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

  const existingDocs = await DeviceModel.find({
    sheetId: options.sheetId,
    deviceId: { $in: devices.map((device) => device.deviceId) },
  }).lean();

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
    await DeviceModel.bulkWrite(operations, { ordered: false });
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
    await SyncEventModel.create({
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
    });
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

  await SyncEventModel.create({
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
