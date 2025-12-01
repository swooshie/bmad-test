import connectToDatabase from "@/lib/db";
import { recordAuditLogFromSyncEvent } from "@/lib/audit/auditLogs";
import SyncEventModel, {
  type SyncEventType,
  type SyncRunMetadata,
  type SyncRunStatus,
  type SyncRunTrigger,
} from "@/models/SyncEvent";
import logger from "@/lib/logging";
import type { AllowlistDiff } from "@/lib/config";
import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

export type SyncRunTelemetryPayload = {
  sheetId: string;
  runId: string;
  trigger: SyncRunTrigger;
  requestedBy?: string | null;
  anonymized?: boolean;
  mode?: "live" | "dry-run";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  rowsProcessed: number;
  rowsSkipped?: number;
  conflicts?: number;
  rowCount?: number;
  status: SyncRunStatus;
  queueLatencyMs?: number | null;
  reason?: string | null;
  anomalies?: string[];
  added?: number;
  updated?: number;
  unchanged?: number;
  legacyIdsUpdated?: number;
  serialConflicts?: number;
  columnsAdded?: number;
  columnsRemoved?: number;
  columnTotal?: number;
  columnVersion?: string;
  rowsAudited?: number;
  missingSerialCount?: number;
  skippedRows?: unknown[];
  schemaChange?: {
    added: string[];
    removed: string[];
    renamed: Array<{ from: string; to: string }>;
    previousVersion?: string | null;
    currentVersion?: string | null;
    detectedAt: string;
    alertDispatched?: boolean;
    suppressionReason?: string | null;
    mode?: "live" | "dry-run";
  };
};

export const serializeSyncRunTelemetry = (
  payload: SyncRunTelemetryPayload
): SyncRunMetadata => ({
  sheetId: payload.sheetId,
  runId: payload.runId,
  trigger: payload.trigger,
  requestedBy: payload.requestedBy ?? null,
  anonymized: payload.anonymized ?? false,
  mode: payload.mode ?? "live",
  startedAt: payload.startedAt,
  completedAt: payload.completedAt,
  durationMs: payload.durationMs,
  rowsProcessed: payload.rowsProcessed,
  rowsSkipped: payload.rowsSkipped ?? 0,
  skipped: payload.rowsSkipped ?? 0,
  conflicts: payload.conflicts ?? payload.serialConflicts ?? 0,
  rowCount: payload.rowCount ?? payload.rowsProcessed,
  status: payload.status,
  queueLatencyMs: payload.queueLatencyMs ?? null,
  reason: payload.reason ?? null,
  anomalies: payload.anomalies ?? [],
  added: payload.added ?? 0,
  updated: payload.updated ?? 0,
  unchanged: payload.unchanged ?? 0,
  legacyIdsUpdated: payload.legacyIdsUpdated ?? 0,
  serialConflicts: payload.serialConflicts ?? payload.conflicts ?? 0,
  columnsAdded: payload.columnsAdded ?? 0,
  columnsRemoved: payload.columnsRemoved ?? 0,
  columnTotal: payload.columnTotal ?? null,
  columnVersion: payload.columnVersion ?? null,
  rowsAudited: payload.rowsAudited ?? 0,
  missingSerialCount: payload.missingSerialCount ?? 0,
  skippedRows: payload.skippedRows ?? [],
  schemaChange: payload.schemaChange ?? undefined,
});

export type AuthFailureAuditPayload = {
  route: string;
  method: string;
  reason: string;
  requestId?: string;
  ip?: string;
  userEmail?: string | null;
};

export const recordAuthFailureEvent = async (
  payload: AuthFailureAuditPayload
): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "AUTH_INVALID_SESSION" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: payload.reason,
    requestId: payload.requestId,
    ip: payload.ip,
    userEmail: payload.userEmail ?? null,
  });

  await recordAuditLogFromSyncEvent({
    eventType: "AUTH_INVALID_SESSION",
    action: payload.reason,
    actor: payload.userEmail,
    status: "error",
    context: { route: payload.route, method: payload.method, requestId: payload.requestId, ip: payload.ip },
  });
};

export const recordConfigValidationEvent = async (payload: {
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error(
      { event: "CONFIG_VALIDATION_AUDIT_FAILED", reason: payload.reason, error },
      "Unable to persist config validation event"
    );
    return;
  }

  await SyncEventModel.create({
    eventType: "CONFIG_VALIDATION" as SyncEventType,
    route: "startup",
    method: "SYSTEM",
    reason: payload.reason,
    metadata: payload.metadata ?? {},
  });

  await recordAuditLogFromSyncEvent({
    eventType: "CONFIG_VALIDATION",
    action: payload.reason,
    status: "success",
    context: payload.metadata,
  });
};

export const recordAllowlistChangeEvent = async (payload: {
  route: string;
  method: string;
  diff: AllowlistDiff;
  userEmail: string | null;
  requestId?: string;
  ip?: string;
}): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "ALLOWLIST_CHANGE" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: "ALLOWLIST_UPDATED",
    userEmail: payload.userEmail,
    requestId: payload.requestId,
    ip: payload.ip,
    metadata: {
      added: payload.diff.added,
      removed: payload.diff.removed,
      unchanged: payload.diff.unchanged,
    },
  });

  await recordAuditLogFromSyncEvent({
    eventType: "ALLOWLIST_CHANGE",
    action: "ALLOWLIST_UPDATED",
    actor: payload.userEmail,
    status: "success",
    context: {
      route: payload.route,
      method: payload.method,
      diff: payload.diff,
      requestId: payload.requestId,
      ip: payload.ip,
    },
  });
};

export const recordAllowlistAccessDeniedEvent = async (payload: {
  route: string;
  method: string;
  reason: string;
  userEmail: string | null;
  requestId?: string;
  ip?: string;
}): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "ALLOWLIST_ACCESS_DENIED" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: payload.reason,
    userEmail: payload.userEmail,
    requestId: payload.requestId,
    ip: payload.ip,
  });

  await recordAuditLogFromSyncEvent({
    eventType: "ALLOWLIST_ACCESS_DENIED",
    action: payload.reason,
    actor: payload.userEmail,
    status: "error",
    context: {
      route: payload.route,
      method: payload.method,
      requestId: payload.requestId,
      ip: payload.ip,
    },
    errorCode: payload.reason,
  });
};

export const recordGovernanceExportEvent = async (payload: {
  route: string;
  method: string;
  userEmail: string | null;
  requestId?: string;
  ip?: string;
  flaggedCount: number;
  totalCount: number;
  countsByStatus: Record<string, number>;
  filters: DeviceGridQueryFilters;
}): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "GOVERNANCE_EXPORT" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: "GOVERNANCE_EXPORT_TRIGGERED",
    userEmail: payload.userEmail,
    requestId: payload.requestId,
    ip: payload.ip,
    metadata: {
      flaggedCount: payload.flaggedCount,
      totalCount: payload.totalCount,
      countsByStatus: payload.countsByStatus,
      filters: payload.filters,
    },
  });

  await recordAuditLogFromSyncEvent({
    eventType: "GOVERNANCE_EXPORT",
    action: "GOVERNANCE_EXPORT_TRIGGERED",
    actor: payload.userEmail,
    status: "success",
    context: {
      route: payload.route,
      method: payload.method,
      requestId: payload.requestId,
      ip: payload.ip,
      flaggedCount: payload.flaggedCount,
      totalCount: payload.totalCount,
    },
  });
};

export const recordAnonymizationToggleEvent = async (payload: {
  route: string;
  method: string;
  enabled: boolean;
  userEmail: string | null;
  requestId?: string;
  ip?: string;
}): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "ANONYMIZATION_TOGGLED" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: payload.enabled ? "ANONYMIZATION_ENABLED" : "ANONYMIZATION_DISABLED",
    userEmail: payload.userEmail,
    requestId: payload.requestId,
    ip: payload.ip,
    metadata: {
      enabled: payload.enabled,
    },
  });

  await recordAuditLogFromSyncEvent({
    eventType: "ANONYMIZATION_TOGGLED",
    action: payload.enabled ? "ANONYMIZATION_ENABLED" : "ANONYMIZATION_DISABLED",
    actor: payload.userEmail,
    status: "success",
    context: {
      route: payload.route,
      method: payload.method,
      requestId: payload.requestId,
      ip: payload.ip,
      enabled: payload.enabled,
    },
  });
};

export const recordFilterChipUpdatedEvent = async (payload: {
  route: string;
  method: string;
  filters: DeviceGridQueryFilters;
  total?: number | null;
  requestId?: string;
  userEmail?: string | null;
  columnsVersion?: string;
}): Promise<void> => {
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error(
      { event: "FILTER_CHIP_AUDIT_FAILED", error, filters: payload.filters },
      "Unable to persist filter chip update"
    );
    return;
  }

  await SyncEventModel.create({
    eventType: "FILTER_CHIP_UPDATED" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: "FILTERS_APPLIED",
    requestId: payload.requestId,
    userEmail: payload.userEmail ?? null,
    metadata: {
      filters: payload.filters,
      total: payload.total ?? null,
      columnsVersion: payload.columnsVersion ?? null,
    },
  });

  await recordAuditLogFromSyncEvent({
    eventType: "FILTER_CHIP_UPDATED",
    action: "FILTERS_APPLIED",
    actor: payload.userEmail,
    status: "success",
    context: {
      route: payload.route,
      method: payload.method,
      filters: payload.filters,
      total: payload.total ?? null,
      requestId: payload.requestId,
      columnsVersion: payload.columnsVersion ?? null,
    },
  });
};

export const recordIconActionEvent = async (payload: {
  actionId: string;
  durationMs: number;
  anonymized?: boolean;
  reducedMotion?: boolean;
  requestId?: string;
  route: string;
}): Promise<void> => {
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error(
      { event: "ICON_ACTION_AUDIT_FAILED", actionId: payload.actionId, error },
      "Unable to persist icon action event"
    );
    return;
  }

  await SyncEventModel.create({
    eventType: "ICON_ACTION_TRIGGERED",
    route: payload.route,
    method: "POST",
    reason: "ICON_ACTION_TRIGGERED",
    requestId: payload.requestId,
    metadata: {
      actionId: payload.actionId,
      durationMs: payload.durationMs,
      anonymized: payload.anonymized ?? false,
      reducedMotion: payload.reducedMotion ?? false,
      recordedAt: new Date().toISOString(),
    },
  });

  await recordAuditLogFromSyncEvent({
    eventType: "ICON_ACTION_TRIGGERED",
    action: "ICON_ACTION_TRIGGERED",
    status: "success",
    context: {
      actionId: payload.actionId,
      durationMs: payload.durationMs,
      anonymized: payload.anonymized ?? false,
      reducedMotion: payload.reducedMotion ?? false,
      requestId: payload.requestId,
      route: payload.route,
    },
  });
};
