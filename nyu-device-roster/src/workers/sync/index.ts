import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";

import connectToDatabase from "@/lib/db";
import { recordAuditLogFromSyncEvent } from "@/lib/audit/auditLogs";
import { serializeSyncRunTelemetry } from "@/lib/audit/syncEvents";
import { fetchSheetData, type FetchSheetDataResult, type TypedRow } from "@/lib/google-sheets";
import { AppError, isTransactionUnsupportedError, mapToAppError } from "@/lib/errors/app-error";
import { logger, logSyncRunCompleted, logSyncRunStarted } from "@/lib/logging";
import DeviceModel from "@/models/Device";
import ColumnDefinitionModel, { type ColumnDefinitionAttributes } from "@/models/ColumnDefinition";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";

import {
  normalizeSheetRows,
  type NormalizedDevice,
} from "@/workers/sync/transform";
import {
  buildHeaderRegistry,
  deriveRegistryVersion,
  diffHeaderRegistry,
  normalizeHeaderKey,
} from "@/workers/sync/header-map";
import {
  runSerialAudit,
  AUDIT_SKIPPED_ROW_SAMPLE_LIMIT,
  type SerialAuditResult,
} from "@/workers/sync/audit";

const TELEMETRY_WEBHOOK_ENABLED = process.env.TELEMETRY_WEBHOOK_ENABLED === "true";
const TELEMETRY_WEBHOOK_URL = process.env.TELEMETRY_WEBHOOK_URL;
const TELEMETRY_WEBHOOK_CHANNEL = process.env.TELEMETRY_WEBHOOK_CHANNEL;
const SCHEMA_ALERTS_PAUSED = process.env.SCHEMA_ALERTS_PAUSED === "true";
const SYNC_MODE = (process.env.SYNC_MODE as "live" | "dry-run" | undefined) ?? "live";
export type UpsertSummary = {
  added: number;
  updated: number;
  unchanged: number;
  durationMs: number;
  runId: string;
  anomalies: string[];
  serialConflicts: number;
  legacyIdsUpdated: number;
};

type SyncTriggerContext = {
  type: "manual" | "scheduled" | "system";
  requestedBy?: string | null;
  anonymized?: boolean;
  queueLatencyMs?: number;
  mode?: "live" | "dry-run";
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
  columnDefinitionsVersion?: string;
  afterUpsert?: (context: { session?: ClientSession; runId: string }) => Promise<void>;
  mode?: "live" | "dry-run";
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
  try {
    if (session) {
      await SyncEventModel.create([payload], { session });
    } else {
      await SyncEventModel.create(payload);
    }
  } catch (error) {
    logger.error(
      {
        event: "SYNC_EVENT_PERSIST_FAILED",
        payload,
        hasSession: Boolean(session),
        error,
      },
      "Failed to persist sync event"
    );
    throw error;
  }

  const rawStatus = (payload.metadata?.status as string | undefined) ?? "success";
  const status: "success" | "error" | "skipped" =
    rawStatus === "failed" ? "error" : rawStatus === "skipped" ? "skipped" : "success";

  await recordAuditLogFromSyncEvent({
    eventType: payload.eventType,
    action: payload.reason ?? payload.eventType,
    actor: payload.userEmail,
    status,
    errorCode: (payload.metadata?.errorCode as string | undefined) ?? undefined,
    context: payload.metadata,
  });
};

type ColumnRegistrySyncResult = {
  added: number;
  removed: number;
  total: number;
  previousVersion: string | null;
  currentVersion: string;
  diff: ReturnType<typeof diffHeaderRegistry>;
};

const synchronizeColumnRegistry = async (
  params: {
    sheetId: string;
    entries: ReturnType<typeof buildHeaderRegistry>;
    version: string;
    mode?: "live" | "dry-run";
  },
  session?: ClientSession
): Promise<ColumnRegistrySyncResult> => {
  const now = new Date();
  const existing = await ColumnDefinitionModel.find({ sheetId: params.sheetId })
    .session(session ?? undefined)
    .lean<ColumnDefinitionAttributes[]>();
  const activeEntries = existing
    .filter((entry) => entry.removedAt === null || entry.removedAt === undefined)
    .map((entry) => ({
      key: entry.columnKey,
      label: entry.label,
      displayOrder: entry.displayOrder,
      dataType: entry.dataType,
      nullable: entry.nullable,
    }));

  const diff = diffHeaderRegistry(params.entries, activeEntries);
  const previousVersion = activeEntries.length ? deriveRegistryVersion(activeEntries) : null;

  const operations: Parameters<typeof ColumnDefinitionModel.bulkWrite>[0] = [];

  diff.added.forEach((entry) => {
    operations.push({
      updateOne: {
        filter: { sheetId: params.sheetId, columnKey: entry.key },
        update: {
          $set: {
            sheetId: params.sheetId,
            columnKey: entry.key,
            label: entry.label,
            displayOrder: entry.displayOrder,
            dataType: entry.dataType,
            nullable: entry.nullable,
            lastSeenAt: now,
            removedAt: null,
            sourceVersion: params.version,
          },
          $setOnInsert: {
            detectedAt: now,
          },
        },
        upsert: true,
      },
    });
  });

  diff.unchanged.forEach((entry) => {
    operations.push({
      updateOne: {
        filter: { sheetId: params.sheetId, columnKey: entry.key },
        update: {
          $set: {
            label: entry.label,
            displayOrder: entry.displayOrder,
            dataType: entry.dataType,
            nullable: entry.nullable,
            lastSeenAt: now,
            removedAt: null,
            sourceVersion: params.version,
          },
        },
        upsert: false,
      },
    });
  });

  diff.removed.forEach((entry) => {
    operations.push({
      updateOne: {
        filter: { sheetId: params.sheetId, columnKey: entry.key, removedAt: null },
        update: {
          $set: {
            removedAt: now,
          },
        },
        upsert: false,
      },
    });
  });

  if (operations.length > 0 && params.mode !== "dry-run") {
    await ColumnDefinitionModel.bulkWrite(operations, {
      ordered: false,
      session: session ?? undefined,
    });
  }

  return {
    added: diff.added.length,
    removed: diff.removed.length,
    total: params.entries.length,
    previousVersion,
    currentVersion: params.version,
    diff,
  };
};

const applyDynamicAttributesUpdate = (
  target: { $set: Record<string, unknown>; $unset?: Record<string, unknown> },
  dynamicAttributes?: Record<string, string | number | boolean | null>
) => {
  if (dynamicAttributes && Object.keys(dynamicAttributes).length > 0) {
    target.$set.dynamicAttributes = dynamicAttributes;
  } else {
    target.$unset = { ...(target.$unset ?? {}), dynamicAttributes: "" };
  }
};

const applyColumnDefinitionsVersionUpdate = (
  target: { $set: Record<string, unknown>; $unset?: Record<string, unknown> },
  version?: string
) => {
  if (version) {
    target.$set.columnDefinitionsVersion = version;
    return;
  }
  target.$unset = { ...(target.$unset ?? {}), columnDefinitionsVersion: "" };
};

export const applyDeviceUpserts = async (
  devices: NormalizedDevice[],
  options: ApplyDeviceUpsertsOptions
): Promise<UpsertSummary> => {
  const started = Date.now();
  const runId = options.runId ?? randomUUID();
  const startedAtIso = new Date(started).toISOString();
  const mode = options.mode ?? options.trigger?.mode ?? "live";

  if (devices.length === 0) {
    const completedAtIso = new Date().toISOString();
    const durationMs = Date.now() - started;
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
      const metadata = serializeSyncRunTelemetry({
        sheetId: options.sheetId,
        runId,
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
        anonymized: options.trigger?.anonymized ?? false,
        mode,
        startedAt: startedAtIso,
        completedAt: completedAtIso,
        durationMs,
        rowsProcessed: 0,
        rowsSkipped: options.rowCount ?? 0,
        conflicts: 0,
        rowCount: options.rowCount ?? 0,
        status: "success",
        queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
        anomalies: options.anomalies ?? [],
        added: 0,
        updated: 0,
        unchanged: 0,
        legacyIdsUpdated: 0,
        serialConflicts: 0,
      });
      await writeSyncEvent(
        {
          eventType: "SYNC_RUN",
          route: "workers/sync",
          method: "TASK",
          requestId: options.requestId,
          metadata,
        },
        session ?? undefined
      );
    }

    await options.afterUpsert?.({ session: undefined, runId });

    return {
      added: 0,
      updated: 0,
      unchanged: 0,
      durationMs,
      runId,
      anomalies: options.anomalies ?? [],
      serialConflicts: 0,
      legacyIdsUpdated: 0,
    };
  }

  const executeUpserts = async (session?: ClientSession): Promise<UpsertSummary> => {
    const existingDocs = await DeviceModel.find({
      sheetId: options.sheetId,
      serial: { $in: devices.map((device) => device.serial) },
    })
      .session(session ?? undefined)
      .lean();

    const existingMap = new Map(existingDocs.map((doc) => [doc.serial, doc]));

    const seenSerials = new Set<string>();
    const duplicateRows: string[] = [];

    const operations: Parameters<typeof DeviceModel.bulkWrite>[0] = [];
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let legacyIdsUpdated = 0;
    const skippedAnomalies: string[] = [];

    for (const device of devices) {
      const deviceId = device.serial?.trim();
      if (!deviceId) {
        skippedAnomalies.push(`Missing serial/deviceId for sheet ${device.sheetId}; row skipped`);
        continue;
      }
      if (seenSerials.has(deviceId)) {
        duplicateRows.push(`Duplicate serial detected for ${deviceId} in sheet ${device.sheetId}`);
        continue;
      }
      seenSerials.add(deviceId);

      const existing = existingMap.get(deviceId);
      if (!existing) {
        added += 1;
        const insertUpdate: { $set: Record<string, unknown>; $unset?: Record<string, unknown> } = {
          $set: {
            deviceId,
            legacyDeviceId: device.legacyDeviceId ?? null,
            serial: deviceId,
            assignedTo: device.assignedTo,
            status: device.status,
            condition: device.condition,
            offboardingStatus: device.offboardingStatus ?? null,
            lastSeen: device.lastSeen ?? null,
            lastSyncedAt: device.lastSyncedAt,
            contentHash: device.contentHash,
          },
        };
        applyDynamicAttributesUpdate(insertUpdate, device.dynamicAttributes);
        applyColumnDefinitionsVersionUpdate(
          insertUpdate,
          device.columnDefinitionsVersion ?? options.columnDefinitionsVersion
        );
        operations.push({
          updateOne: {
            filter: { serial: deviceId, sheetId: device.sheetId },
            update: insertUpdate,
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
      if (device.legacyDeviceId && device.legacyDeviceId !== existing.legacyDeviceId) {
        legacyIdsUpdated += 1;
      }
      const updateDoc: { $set: Record<string, unknown>; $unset?: Record<string, unknown> } = {
        $set: {
          deviceId,
          legacyDeviceId: device.legacyDeviceId ?? existing.legacyDeviceId ?? null,
          serial: deviceId,
          assignedTo: device.assignedTo,
          status: device.status,
          condition: device.condition,
          offboardingStatus: device.offboardingStatus ?? null,
          lastSeen: device.lastSeen ?? null,
          lastSyncedAt: device.lastSyncedAt,
          contentHash: device.contentHash,
        },
      };
      applyDynamicAttributesUpdate(updateDoc, device.dynamicAttributes);
      applyColumnDefinitionsVersionUpdate(
        updateDoc,
        device.columnDefinitionsVersion ?? options.columnDefinitionsVersion
      );
      operations.push({
        updateOne: {
          filter: { serial: deviceId, sheetId: device.sheetId },
          update: updateDoc,
          upsert: false,
        },
      });
    }

    if (operations.length > 0 && mode !== "dry-run") {
      const performBulkWrite = async () => {
        try {
          await DeviceModel.bulkWrite(operations, { ordered: false, session: session ?? undefined });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("device_sheet_unique")) {
            // Drop legacy index (device_sheet_unique) so serial uniqueness remains the only constraint
            try {
              await DeviceModel.collection.dropIndex("device_sheet_unique");
            } catch {
              // ignore drop failures (index may not exist)
            }
            await DeviceModel.bulkWrite(operations, { ordered: false, session: session ?? undefined });
            return;
          }
          throw error;
        }
      };
      await performBulkWrite();
    }

    if (options.afterUpsert) {
      await options.afterUpsert({ session: session ?? undefined, runId });
    }

    const anomalies = [...(options.anomalies ?? []), ...duplicateRows, ...skippedAnomalies];
    const completedAt = Date.now();
    const durationMs = completedAt - started;
    const completedAtIso = new Date(completedAt).toISOString();

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
        serialConflicts: duplicateRows.length,
        legacyIdsUpdated,
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
      },
      "Device sync upsert phase completed"
    );

    if (!options.skipSyncEvent) {
      const metadata = serializeSyncRunTelemetry({
        sheetId: options.sheetId,
        runId,
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
        anonymized: options.trigger?.anonymized ?? false,
        mode,
        startedAt: startedAtIso,
        completedAt: completedAtIso,
        durationMs: options.durationMs ?? durationMs,
        rowsProcessed: options.rowCount ?? devices.length,
        rowsSkipped: Math.max(
          (options.rowCount ?? devices.length) - (added + updated + unchanged),
          0
        ),
        conflicts: duplicateRows.length,
        rowCount: options.rowCount ?? devices.length,
        status: "success",
        queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
        anomalies,
        added,
        updated,
        unchanged,
        legacyIdsUpdated,
        serialConflicts: duplicateRows.length,
      });
      await writeSyncEvent(
        {
          eventType: "SYNC_RUN",
          route: "workers/sync",
          method: "TASK",
          requestId: options.requestId,
          metadata,
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
      serialConflicts: duplicateRows.length,
      legacyIdsUpdated,
    };
  };

  type DeviceSnapshot = Array<{
    serial: string;
    legacyDeviceId?: string | null;
    sheetId: string;
    assignedTo: string;
    status: string;
    condition: string;
    offboardingStatus?: string | null;
    lastSeen?: Date | null;
    lastSyncedAt: Date;
    contentHash: string;
    serialMigratedAt?: Date | null;
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

  if (mode === "dry-run") {
    return await executeUpserts();
  }

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
    logger.error(
      {
        event: "DEVICE_SYNC_TRANSACTION_ERROR",
        sheetId: options.sheetId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      },
      "Device sync transaction failed"
    );
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
  mode?: "live" | "dry-run";
};

export type RunDeviceSyncResult = {
  sheetId: string;
  rowCount: number;
  skipped: number;
  anomalies: string[];
  upsert: UpsertSummary;
  durationMs: number;
  audit: SerialAuditResult;
  columnRegistry?: ColumnRegistrySyncResult;
  columnRegistryVersion?: string;
  schemaChange?: {
    added: string[];
    removed: string[];
    renamed: Array<{ from: string; to: string }>;
    previousVersion: string | null;
    currentVersion: string | null;
    alertDispatched: boolean;
    suppressionReason: string | null;
    mode: "live" | "dry-run";
  };
};

export const runDeviceSync = async (
  options: RunDeviceSyncOptions
): Promise<RunDeviceSyncResult> => {
  await connectToDatabase();

  const runId = options.runId ?? randomUUID();
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const triggerType = options.trigger?.type ?? "system";
  const mode = options.mode ?? options.trigger?.mode ?? SYNC_MODE;
  logSyncRunStarted({
    runId,
    sheetId: options.sheetId,
    trigger: triggerType,
    requestedBy: options.trigger?.requestedBy ?? null,
    startedAt: startedAtIso,
    queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
  });
  const tabName = options.tabName ?? "Devices";
  const fetchStart = Date.now();

  const sheetData: FetchSheetDataResult = options.overrideRows
    ? (() => {
        const orderedKeys = Array.from(
          options.overrideRows.reduce<Set<string>>((set, row) => {
            Object.keys(row).forEach((key) => set.add(key));
            return set;
          }, new Set<string>())
        );
        const headers = orderedKeys.map((key, index) =>
          key.trim().length ? key.trim() : `column_${index + 1}`
        );
        const orderedHeaders = headers.map((header, index) => {
          const normalized = header
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
          return {
            name: header,
            normalizedName: normalized.length ? normalized : `column_${index + 1}`,
            position: index,
          };
        });
        return {
          headers,
          orderedHeaders,
          rows: options.overrideRows,
          rowMetadata: options.overrideRows.map((_, index) => ({
            rowNumber: index + 2,
            raw: [],
          })),
          metrics: {
            durationMs: 0,
            rowCount: options.overrideRows.length,
            pageCount: 1,
            startedAt: new Date(fetchStart).toISOString(),
            completedAt: new Date(fetchStart).toISOString(),
            sheetId: options.sheetId,
            tabName,
            requestId: options.requestId,
            headerCount: orderedHeaders.length,
            retryCount: 0,
          },
        } satisfies FetchSheetDataResult;
      })()
    : await fetchSheetData({
        sheetId: options.sheetId,
        tabName,
        requestId: options.requestId,
        includeEmptyRows: true,
      });

  const rows = sheetData.rows;
  const fetchDuration = sheetData.metrics?.durationMs ?? Date.now() - fetchStart;

  const audit = await runSerialAudit({
    sheetId: options.sheetId,
    tabName,
    requestId: options.requestId,
    trigger: options.trigger,
    mode: "live",
    prefetchedData: sheetData,
  });

  if (audit.missingSerialCount > 0) {
    const skippedCompletedAtIso = new Date().toISOString();
    const skippedDuration = Date.now() - startedAt;
    const skippedMetadata = serializeSyncRunTelemetry({
      sheetId: options.sheetId,
      runId,
      trigger: triggerType,
      requestedBy: options.trigger?.requestedBy ?? null,
      anonymized: options.trigger?.anonymized ?? false,
      startedAt: startedAtIso,
      completedAt: skippedCompletedAtIso,
      durationMs: skippedDuration,
      rowsProcessed: rows.length,
      rowsSkipped: rows.length,
      conflicts: 0,
      rowCount: rows.length,
      status: "skipped",
      queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
      reason: "serial_audit_blocked",
      rowsAudited: audit.rowsAudited,
      missingSerialCount: audit.missingSerialCount,
      skippedRows: audit.missingSerialRows.slice(0, AUDIT_SKIPPED_ROW_SAMPLE_LIMIT),
    });
    await writeSyncEvent(
      {
        eventType: "SYNC_RUN",
        route: "workers/sync",
        method: "TASK",
        requestId: options.requestId,
        metadata: skippedMetadata,
      },
      undefined
    );

    logSyncRunCompleted({
      runId,
      sheetId: options.sheetId,
      trigger: triggerType,
      requestedBy: options.trigger?.requestedBy ?? null,
      startedAt: startedAtIso,
      completedAt: skippedCompletedAtIso,
      durationMs: skippedDuration,
      rowsProcessed: rows.length,
      rowsSkipped: rows.length,
      conflicts: 0,
      status: "skipped",
      queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
    });

    throw new AppError({
      code: "SERIAL_AUDIT_FAILED",
      message: "Serial audit detected missing serial values. Fix the sheet and retry the sync run.",
      httpStatus: 409,
      details: {
        missingSerialCount: audit.missingSerialCount,
        rowsAudited: audit.rowsAudited,
      },
    });
  }

  logger.debug(
    {
      event: "DEVICE_SYNC_FETCH",
      sheetId: options.sheetId,
      durationMs: fetchDuration,
      rowCount: rows.length,
    },
    "Fetched Google Sheets rows"
  );

  const orderedHeadersForRegistry = sheetData.orderedHeaders
    ? sheetData.orderedHeaders
    : sheetData.headers.map((header, index) => ({
        name: header,
        normalizedName: normalizeHeaderKey(header, index + 1),
        position: index,
      }));
  const headerRegistryEntries = buildHeaderRegistry(orderedHeadersForRegistry, rows);
  const registryVersion = deriveRegistryVersion(headerRegistryEntries);
  const normalization = normalizeSheetRows(rows, {
    sheetId: options.sheetId,
    headers: sheetData.orderedHeaders,
    columnDefinitionsVersion: registryVersion,
  });
  let registrySummary: ColumnRegistrySyncResult | undefined;
  const synchronizeRegistry = async (context: { session?: ClientSession }) => {
    registrySummary = await synchronizeColumnRegistry(
      {
        sheetId: options.sheetId,
        entries: headerRegistryEntries,
        version: registryVersion,
        mode,
      },
      context.session
    );
  };

  const upsert = await applyDeviceUpserts(normalization.devices, {
    sheetId: options.sheetId,
    requestId: options.requestId,
    anomalies: normalization.anomalies,
    trigger: options.trigger,
    runId,
    rowCount: normalization.rowCount,
    durationMs: undefined,
    skipSyncEvent: true,
    columnDefinitionsVersion: registryVersion,
    afterUpsert: synchronizeRegistry,
    mode,
  });

  const completedAt = Date.now();
  const totalDurationMs = completedAt - startedAt;
  const completedAtIso = new Date(completedAt).toISOString();

  logger.info(
    {
      event: "DEVICE_SYNC_COMPLETED",
      sheetId: options.sheetId,
      runId: upsert.runId,
      rowCount: normalization.rowCount,
      skipped: normalization.skipped,
      durationMs: totalDurationMs,
      startedAt: startedAtIso,
      completedAt: completedAtIso,
      trigger: options.trigger?.type ?? "system",
      requestedBy: options.trigger?.requestedBy ?? null,
      anonymized: options.trigger?.anonymized ?? false,
      columnsAdded: registrySummary?.added ?? 0,
      columnsRemoved: registrySummary?.removed ?? 0,
      columnTotal: registrySummary?.total ?? headerRegistryEntries.length,
      columnVersion: registryVersion,
    },
    "Device sync pipeline completed"
  );

  const schemaChangeDiff = registrySummary?.diff;
  const hasSchemaChange =
    schemaChangeDiff !== undefined &&
    (schemaChangeDiff.added.length > 0 ||
      schemaChangeDiff.removed.length > 0 ||
      schemaChangeDiff.renamed.length > 0);

  let schemaAlertDispatched = false;
  let schemaAlertSuppressionReason: string | null = null;

  if (hasSchemaChange) {
    if (mode === "dry-run") {
      schemaAlertSuppressionReason = "dry-run-mode";
    } else if (SCHEMA_ALERTS_PAUSED) {
      schemaAlertSuppressionReason = "schema-alerts-paused";
    } else if (!TELEMETRY_WEBHOOK_ENABLED || !TELEMETRY_WEBHOOK_URL) {
      schemaAlertSuppressionReason = "webhook-disabled";
    } else {
      try {
        const payload = {
          text: [
            `Schema change detected for ${options.sheetId}`,
            `Run: ${runId} (trigger=${triggerType})`,
            `Added: ${schemaChangeDiff?.added.map((c) => c.label).join(", ") || "none"}`,
            `Removed: ${schemaChangeDiff?.removed.map((c) => c.label).join(", ") || "none"}`,
            `Renamed: ${
              schemaChangeDiff?.renamed
                .map((pair) => `${pair.from.label} -> ${pair.to.label}`)
                .join(", ") || "none"
            }`,
            `Version: ${registrySummary?.previousVersion ?? "n/a"} -> ${registrySummary?.currentVersion ?? "n/a"}`,
            `Runbook: docs/runbook/sync-operations.md#schema-change-alerts`,
          ].join("\\n"),
          channel: TELEMETRY_WEBHOOK_CHANNEL,
        };
        await fetch(TELEMETRY_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        schemaAlertDispatched = true;
      } catch (error) {
        logger.error(
          { event: "SCHEMA_CHANGE_ALERT_FAILED", runId, sheetId: options.sheetId, error },
          "Failed to dispatch schema change alert"
        );
        schemaAlertSuppressionReason = "alert-dispatch-failed";
      }
    }
  }

  if (hasSchemaChange) {
    logger.info(
      {
        event: "SCHEMA_CHANGE_DETECTED",
        sheetId: options.sheetId,
        runId,
        added: schemaChangeDiff?.added.map((c) => c.label),
        removed: schemaChangeDiff?.removed.map((c) => c.label),
        renamed: schemaChangeDiff?.renamed.map((pair) => `${pair.from.label}->${pair.to.label}`),
        previousVersion: registrySummary?.previousVersion,
        currentVersion: registrySummary?.currentVersion,
        trigger: triggerType,
        mode,
        alertStatus: schemaAlertDispatched ? "dispatched" : "suppressed",
        suppressionReason: schemaAlertSuppressionReason,
      },
      "Schema change detected during sync run"
    );
  }

  const successMetadata = serializeSyncRunTelemetry({
    sheetId: options.sheetId,
    runId,
    trigger: triggerType,
    requestedBy: options.trigger?.requestedBy ?? null,
    anonymized: options.trigger?.anonymized ?? false,
    mode,
    startedAt: startedAtIso,
    completedAt: completedAtIso,
    durationMs: totalDurationMs,
    rowsProcessed: normalization.rowCount,
    rowsSkipped: normalization.skipped,
    conflicts: upsert.serialConflicts,
    rowCount: normalization.rowCount,
    status: "success",
    queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
    anomalies: upsert.anomalies,
    added: upsert.added,
    updated: upsert.updated,
    unchanged: upsert.unchanged,
    legacyIdsUpdated: upsert.legacyIdsUpdated,
    serialConflicts: upsert.serialConflicts,
    rowsAudited: audit.rowsAudited,
    missingSerialCount: audit.missingSerialCount,
    skippedRows: [],
    columnsAdded: registrySummary?.added,
    columnsRemoved: registrySummary?.removed,
    columnTotal: registrySummary?.total ?? headerRegistryEntries.length,
    columnVersion: registryVersion,
    schemaChange: hasSchemaChange
      ? {
          added: schemaChangeDiff?.added.map((c) => c.label) ?? [],
          removed: schemaChangeDiff?.removed.map((c) => c.label) ?? [],
          renamed:
            schemaChangeDiff?.renamed.map((pair) => ({
              from: pair.from.label,
              to: pair.to.label,
            })) ?? [],
          previousVersion: registrySummary?.previousVersion ?? null,
          currentVersion: registrySummary?.currentVersion ?? registryVersion,
          detectedAt: completedAtIso,
          alertDispatched: schemaAlertDispatched,
          suppressionReason: schemaAlertSuppressionReason,
          mode,
        }
      : undefined,
  });

  await writeSyncEvent({
    eventType: "SYNC_RUN",
    route: "workers/sync",
    method: "TASK",
    requestId: options.requestId,
    metadata: successMetadata,
  });

  logSyncRunCompleted({
    runId,
    sheetId: options.sheetId,
    trigger: triggerType,
    requestedBy: options.trigger?.requestedBy ?? null,
    startedAt: startedAtIso,
    completedAt: completedAtIso,
    durationMs: totalDurationMs,
    rowsProcessed: normalization.rowCount,
    rowsSkipped: normalization.skipped,
    conflicts: upsert.serialConflicts,
    status: "success",
    queueLatencyMs: options.trigger?.queueLatencyMs ?? null,
  });

  if (
    registrySummary &&
    (registrySummary.added > 0 || registrySummary.removed > 0 || registrySummary.diff.renamed.length > 0)
  ) {
    await writeSyncEvent({
      eventType: "SYNC_COLUMNS_CHANGED",
      route: "workers/sync",
      method: "TASK",
      requestId: options.requestId,
      metadata: {
        sheetId: options.sheetId,
        added: registrySummary.added,
        removed: registrySummary.removed,
        total: registrySummary.total,
        columnVersion: registryVersion,
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
        anonymized: options.trigger?.anonymized ?? false,
        renamed: registrySummary.diff.renamed.map((pair) => ({
          from: pair.from.label,
          to: pair.to.label,
        })),
        previousVersion: registrySummary.previousVersion,
        currentVersion: registrySummary.currentVersion,
      },
    });
  }

  return {
    sheetId: options.sheetId,
    rowCount: normalization.rowCount,
    skipped: normalization.skipped,
    anomalies: upsert.anomalies,
    upsert,
    durationMs: totalDurationMs,
    audit,
    columnRegistry: registrySummary,
    columnRegistryVersion: registryVersion,
    schemaChange: hasSchemaChange
      ? {
          added: schemaChangeDiff?.added.map((c) => c.label) ?? [],
          removed: schemaChangeDiff?.removed.map((c) => c.label) ?? [],
          renamed:
            schemaChangeDiff?.renamed.map((pair) => ({
              from: pair.from.label,
              to: pair.to.label,
            })) ?? [],
          previousVersion: registrySummary?.previousVersion ?? null,
          currentVersion: registrySummary?.currentVersion ?? registryVersion,
          alertDispatched: schemaAlertDispatched,
          suppressionReason: schemaAlertSuppressionReason,
          mode,
        }
      : undefined,
  };
};
