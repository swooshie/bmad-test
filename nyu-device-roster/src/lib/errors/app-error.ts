import { randomUUID } from "node:crypto";

import { RuntimeConfigError } from "@/lib/config";
import { SheetFetchError } from "@/lib/google-sheets";

export type SyncErrorCode =
  | "CONFIG_MISSING"
  | "SHEET_NOT_FOUND"
  | "SHEETS_RATE_LIMIT"
  | "SHEETS_AUTH_REVOKED"
  | "INVALID_SYNC_CONFIGURATION"
  | "SERIAL_AUDIT_FAILED"
  | "SYNC_DISABLED"
  | "SYNC_TIMEOUT"
  | "TRANSFORM_VALIDATION_FAILED"
  | "MONGO_WRITE_FAILED"
  | "ROLLBACK_FAILED"
  | "UNAUTHORIZED_CRON"
  | "UNKNOWN_FAILURE";

type ErrorCatalogEntry = {
  httpStatus: number;
  defaultMessage: string;
  recommendation: string;
};

const ERROR_CATALOG: Record<SyncErrorCode, ErrorCatalogEntry> = {
  CONFIG_MISSING: {
    httpStatus: 503,
    defaultMessage: "Sync configuration is unavailable",
    recommendation: "Refresh runtime config or re-run the config seeding workflow.",
  },
  SHEET_NOT_FOUND: {
    httpStatus: 502,
    defaultMessage: "Source Google Sheet was not found",
    recommendation: "Verify the sheet ID and sharing permissions in the runtime config.",
  },
  SHEETS_RATE_LIMIT: {
    httpStatus: 429,
    defaultMessage: "Sheets API throttled the sync request",
    recommendation: "Retry after a minute; consider lowering cadence if throttling persists.",
  },
  SHEETS_AUTH_REVOKED: {
    httpStatus: 401,
    defaultMessage: "Sheets service account lost access",
    recommendation: "Rotate the Sheets service credential in Secret Manager and retry.",
  },
  INVALID_SYNC_CONFIGURATION: {
    httpStatus: 400,
    defaultMessage: "Sync configuration is invalid",
    recommendation: "Fix invalid sync settings (sheetId, tab) and redeploy config.",
  },
  SERIAL_AUDIT_FAILED: {
    httpStatus: 409,
    defaultMessage: "Serial audit blocked the sync run",
    recommendation: "Fill in missing serial numbers in Google Sheets and re-run the audit.",
  },
  SYNC_DISABLED: {
    httpStatus: 202,
    defaultMessage: "Scheduled sync is disabled",
    recommendation: "Flip sync.enabled=true in Config to resume cadence.",
  },
  SYNC_TIMEOUT: {
    httpStatus: 504,
    defaultMessage: "Sync exceeded SLA window",
    recommendation: "Check Cloud Tasks / worker logs to determine the bottleneck.",
  },
  TRANSFORM_VALIDATION_FAILED: {
    httpStatus: 422,
    defaultMessage: "Sheet rows failed validation",
    recommendation: "Fix the highlighted rows in Google Sheets and retry sync.",
  },
  MONGO_WRITE_FAILED: {
    httpStatus: 500,
    defaultMessage: "Database write failed; last dataset was preserved",
    recommendation: "Inspect Mongo logs, then rerun sync (or rollback if failure repeats).",
  },
  ROLLBACK_FAILED: {
    httpStatus: 500,
    defaultMessage: "Rollback utility was unable to restore baseline data",
    recommendation: "Review rollback logs and ensure the baseline snapshot is accessible.",
  },
  UNAUTHORIZED_CRON: {
    httpStatus: 401,
    defaultMessage: "Scheduler headers were missing or invalid",
    recommendation: "Update Cloud Scheduler Secret header to match syncSchedulerToken.",
  },
  UNKNOWN_FAILURE: {
    httpStatus: 500,
    defaultMessage: "Unexpected sync failure occurred",
    recommendation: "Check sync logs with the reference ID for detailed diagnostics.",
  },
};

export type AppErrorInit = {
  code: SyncErrorCode;
  message?: string;
  httpStatus?: number;
  recommendation?: string;
  referenceId?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
};

export class AppError extends Error {
  public readonly code: SyncErrorCode;
  public readonly httpStatus: number;
  public readonly recommendation: string;
  public readonly referenceId: string;
  public readonly details?: Record<string, unknown>;
  public readonly cause?: unknown;

  constructor(init: AppErrorInit) {
    const catalog = ERROR_CATALOG[init.code];
    super(init.message ?? catalog?.defaultMessage ?? "Unexpected failure");
    this.name = "AppError";
    this.code = init.code;
    this.httpStatus = init.httpStatus ?? catalog?.httpStatus ?? 500;
    this.recommendation = init.recommendation ?? catalog?.recommendation ?? "Retry later.";
    this.referenceId = init.referenceId ?? randomUUID();
    this.details = init.details;
    this.cause = init.cause;
  }
}

export const isAppError = (value: unknown): value is AppError =>
  value instanceof AppError;

export const isTransactionUnsupportedError = (error: unknown) => {
  return (
    error instanceof Error &&
    /Transaction numbers are only allowed/i.test(error.message)
  );
};

export const mapToAppError = (
  error: unknown,
  fallbackCode: SyncErrorCode = "UNKNOWN_FAILURE",
  overrides?: Partial<AppErrorInit>
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof SheetFetchError) {
    const sheetMap: Record<SheetFetchError["code"], SyncErrorCode> = {
      SHEET_NOT_FOUND: "SHEET_NOT_FOUND",
      RATE_LIMIT: "SHEETS_RATE_LIMIT",
      OAUTH_REVOKED: "SHEETS_AUTH_REVOKED",
      INVALID_CONFIGURATION: "INVALID_SYNC_CONFIGURATION",
      UNKNOWN: fallbackCode,
    };
    return new AppError({
      code: sheetMap[error.code],
      message: error.message,
      httpStatus: error.status ?? ERROR_CATALOG[sheetMap[error.code]].httpStatus,
      cause: error,
      referenceId: randomUUID(),
      ...overrides,
    });
  }

  if (error instanceof RuntimeConfigError) {
    return new AppError({
      code: "CONFIG_MISSING",
      message: error.message,
      cause: error,
      ...overrides,
    });
  }

  if (isTransactionUnsupportedError(error)) {
    return new AppError({
      code: "MONGO_WRITE_FAILED",
      message: "MongoDB transactions are not enabled for this cluster",
      recommendation:
        "Enable replica set / transactions or rely on the rollback utility if failures persist.",
      cause: error,
      ...overrides,
    });
  }

  return new AppError({
    code: fallbackCode,
    cause:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
    ...overrides,
  });
};

export const serializeAppError = (error: AppError) => ({
  code: error.code,
  message: error.message,
  recommendation: error.recommendation,
  referenceId: error.referenceId,
});
