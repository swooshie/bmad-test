import pino from "pino";

const isBrowser = typeof window !== "undefined";
const isDevelopment = process.env.NODE_ENV !== "production";

const createLogger = () => {
  if (isBrowser) {
    return pino({
      level: process.env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
      base: undefined,
      browser: { asObject: true },
    });
  }

  // Server-side: lazily load fs/path to avoid bundling in client chunks
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("node:path") as typeof import("node:path");

  const logFile = process.env.LOG_FILE ?? "logs/app.log";
  const buildStreams = () => {
    const streams: pino.MultistreamOptions["streams"] = [{ stream: process.stdout }];
    if (logFile) {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      streams.push({ stream: pino.destination(logFile) });
    }
    return streams;
  };

  return pino(
    {
      level: process.env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
      base: undefined,
    },
    pino.multistream(buildStreams())
  );
};

export const logger = createLogger();

export type SyncRunTriggerType = "system" | "manual" | "scheduled";

export type SyncRunStatusLog = "success" | "failed" | "skipped";

export type SyncRunStartLog = {
  runId: string;
  sheetId: string;
  trigger: SyncRunTriggerType;
  requestedBy?: string | null;
  startedAt: string;
  queueLatencyMs?: number | null;
};

export type SyncRunCompletedLog = SyncRunStartLog & {
  completedAt: string;
  durationMs: number;
  rowsProcessed: number;
  rowsSkipped: number;
  conflicts: number;
  status: SyncRunStatusLog;
};

export const logSyncRunStarted = (payload: SyncRunStartLog) => {
  logger.info(
    {
      event: "SYNC_RUN_STARTED",
      runId: payload.runId,
      sheetId: payload.sheetId,
      trigger: payload.trigger,
      requestedBy: payload.requestedBy ?? null,
      startedAt: payload.startedAt,
      queueLatencyMs: payload.queueLatencyMs ?? null,
    },
    "Sync run started"
  );
};

export const logSyncRunCompleted = (payload: SyncRunCompletedLog) => {
  logger.info(
    {
      event: "SYNC_RUN_COMPLETED",
      runId: payload.runId,
      sheetId: payload.sheetId,
      trigger: payload.trigger,
      requestedBy: payload.requestedBy ?? null,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt,
      durationMs: payload.durationMs,
      rowsProcessed: payload.rowsProcessed,
      rowsSkipped: payload.rowsSkipped,
      conflicts: payload.conflicts,
      status: payload.status,
      queueLatencyMs: payload.queueLatencyMs ?? null,
    },
    "Sync run completed"
  );
};

export type AuthFailureLog = {
  event: "AUTH_INVALID_SESSION";
  route: string;
  method: string;
  reason: string;
  requestId?: string;
  ip?: string;
  userEmail?: string;
};

export type AllowlistRejectionLog = {
  event: "AUTH_ALLOWLIST_REJECTION";
  email?: string | null;
  reason: "EMAIL_MISSING" | "DOMAIN_REJECTED" | "CONFIG_MISSING" | "NOT_ALLOWLISTED";
  requestId?: string;
  ip?: string;
  timestamp: string;
  operatorId?: string | null;
  allowlistRevision?: string | null;
};

export const logAuthFailure = (payload: AuthFailureLog) => {
  logger.warn(payload, "Auth failure detected");
};

export const logAuthAlert = (payload: AuthFailureLog & { count: number }) => {
  logger.error(payload, "Repeated auth failure threshold reached");
};

export const logAuthSuccess = (meta: {
  route: string;
  method: string;
  userEmail?: string | null;
}) => {
  logger.debug(meta, "Session validated");
};

export const logAllowlistRejection = (payload: AllowlistRejectionLog) => {
  logger.warn(payload, "Allowlist rejection");
};

export const logAllowlistAdmit = (payload: { email: string; ip?: string; timestamp: string }) => {
  logger.debug(payload, "Allowlist admission");
};

type AllowlistDiffLog = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

export const logAllowlistEndpointEvent = (payload: {
  actorEmail?: string | null;
  actorRole?: string | null;
  requestId?: string;
  ip?: string;
  outcome: "granted" | "denied";
  reason?: string;
  diff?: AllowlistDiffLog;
}) => {
  logger.warn(
    {
      event: "ALLOWLIST_ENDPOINT",
      workflow: "allowlist-maintenance",
      actorEmail: payload.actorEmail ?? null,
      actorRole: payload.actorRole ?? null,
      requestId: payload.requestId ?? null,
      ip: payload.ip ?? null,
      outcome: payload.outcome,
      reason: payload.reason ?? null,
      diff: payload.diff,
    },
    payload.outcome === "denied"
      ? "Allowlist endpoint access denied"
      : "Allowlist endpoint accessed"
  );
};

export const logAnonymizationToggle = (payload: {
  enabled: boolean;
  userEmail?: string | null;
  requestId?: string;
}) => {
  logger.info(
    {
      event: "ANONYMIZATION_TOGGLED",
      enabled: payload.enabled,
      userEmail: payload.userEmail ?? null,
      requestId: payload.requestId ?? null,
    },
    payload.enabled ? "Anonymization enabled" : "Anonymization disabled"
  );
};

export type SecretManagerLog = {
  event: "SECRET_MANAGER_FAILURE";
  secretKey: string;
  reason: string;
  attempt?: number;
  action?: string;
  metadata?: Record<string, unknown>;
};

export const logSecretManagerAlert = (payload: SecretManagerLog) => {
  logger.error(payload, "Secret Manager failure");
};

export const logConfigValidationFailure = (payload: {
  reason: string;
  metadata?: Record<string, unknown>;
}) => {
  logger.error(
    {
      event: "CONFIG_VALIDATION_FAILURE",
      ...payload,
    },
    "Runtime configuration validation failed"
  );
};

export type PerformanceMetricLog = {
  event: "PERFORMANCE_METRIC";
  metric: string;
  value: number;
  threshold?: number | null;
  context?: Record<string, string | number | boolean> | undefined;
  requestId?: string | null;
  anonymized?: boolean;
  timestamp: string;
};

export type FilterChipLog = {
  event: "FILTER_CHIP_UPDATED";
  filters: Record<string, unknown>;
  requestId?: string | null;
  anonymized?: boolean;
  total?: number | null;
  columnsVersion?: string;
};

export type DeviceDrawerLog =
  | {
      event: "DEVICE_DRAWER_ACTION";
      action: "EXPORT_AUDIT_SNAPSHOT" | "HANDOFF_INITIATED";
      serial: string;
      userEmail?: string | null;
      requestId?: string | null;
      outcome: "success" | "failure";
      error?: string | null;
    }
  | {
      event: "ANONYMIZATION_CHIP_VIEWED";
      serial: string;
      userEmail?: string | null;
      anonymized: boolean;
      requestId?: string | null;
    };

export const logPerformanceMetric = (payload: PerformanceMetricLog) => {
  logger.info(
    {
      ...payload,
      threshold: payload.threshold ?? null,
      anonymized: payload.anonymized ?? false,
    },
    "Performance metric recorded"
  );
};

export const logFilterChipUpdate = (payload: FilterChipLog) => {
  logger.info(
    {
      ...payload,
      anonymized: payload.anonymized ?? false,
      total: payload.total ?? null,
      columnsVersion: payload.columnsVersion ?? null,
    },
    "Filter chip state updated"
  );
};

export const logDeviceDrawerAction = (payload: DeviceDrawerLog) => {
  logger.info(payload, "Device drawer interaction");
};

export type IconActionLog = {
  event: "ICON_ACTION_TRIGGERED";
  actionId: string;
  durationMs: number;
  anonymized?: boolean;
  reducedMotion?: boolean;
  requestId?: string | null;
  triggeredAt?: string;
};

export const logIconAction = (payload: IconActionLog) => {
  logger.info(
    {
      ...payload,
      anonymized: payload.anonymized ?? false,
      reducedMotion: payload.reducedMotion ?? false,
      triggeredAt: payload.triggeredAt ?? new Date().toISOString(),
    },
    "Icon-first action triggered"
  );
};

export type AnonymizationPresetLog = {
  event: "ANONYMIZATION_PRESET_CHANGED";
  presetId: string;
  overrides?: Record<string, boolean>;
  anonymized: boolean;
  userEmail?: string | null;
  requestId?: string;
};

export const logAnonymizationPresetChange = (payload: AnonymizationPresetLog) => {
  logger.info(
    {
      ...payload,
      overrides: payload.overrides ?? {},
    },
    "Anonymization preset updated"
  );
};

export default logger;
