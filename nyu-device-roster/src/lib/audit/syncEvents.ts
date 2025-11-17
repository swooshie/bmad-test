import connectToDatabase from "@/lib/db";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";
import logger from "@/lib/logging";
import type { AllowlistDiff } from "@/lib/config";
import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

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
};

export const recordFilterChipUpdatedEvent = async (payload: {
  route: string;
  method: string;
  filters: DeviceGridQueryFilters;
  total?: number | null;
  requestId?: string;
  userEmail?: string | null;
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
};
