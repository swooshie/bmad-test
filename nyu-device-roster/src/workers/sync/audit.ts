import { fetchSheetData, AUDIT_RETRY_POLICY, DEFAULT_SHEETS_TAB, type FetchSheetDataResult, type SheetRowMetadata, type TypedCellValue, type TypedRow } from "@/lib/google-sheets";
import { logger } from "@/lib/logging";
import SyncEventModel from "@/models/SyncEvent";
import { recordAuditLogFromSyncEvent } from "@/lib/audit/auditLogs";
import { AppError } from "@/lib/errors/app-error";
import type { SyncTriggerContext } from "@/workers/sync";

export const AUDIT_SKIPPED_ROW_SAMPLE_LIMIT = 25;

export type SerialAuditMode = "live" | "dry-run";

export type MissingSerialRow = {
  rowNumber: number;
  serialValue: string | number | null;
  row: Record<string, string | number | null>;
};

export type SerialAuditResult = {
  sheetId: string;
  tabName: string;
  rowsAudited: number;
  missingSerialCount: number;
  missingSerialRows: MissingSerialRow[];
  status: "passed" | "blocked";
  startedAt: string;
  completedAt: string;
};

type PrefetchedData = Pick<FetchSheetDataResult, "headers" | "rows" | "rowMetadata" | "metrics">;

export type SerialAuditOptions = {
  sheetId: string;
  tabName?: string;
  requestId?: string;
  mode?: SerialAuditMode;
  trigger?: SyncTriggerContext;
  persist?: boolean;
  source?: {
    route: string;
    method: string;
  };
  prefetchedData?: PrefetchedData;
};

const hasSerialValue = (value: TypedCellValue | undefined): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
};

const serializeValue = (value: TypedCellValue | undefined): string | number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const mapRowMetadata = (
  rows: TypedRow[],
  metadata: SheetRowMetadata[]
): { rowNumber: number; record: TypedRow }[] => {
  const limit = Math.min(rows.length, metadata.length);
  const mapped: { rowNumber: number; record: TypedRow }[] = [];
  for (let index = 0; index < limit; index += 1) {
    mapped.push({ rowNumber: metadata[index].rowNumber, record: rows[index] });
  }
  return mapped;
};

export const runSerialAudit = async (
  options: SerialAuditOptions
): Promise<SerialAuditResult> => {
  const startedAt = Date.now();
  const tabName = options.tabName ?? DEFAULT_SHEETS_TAB;
  const data =
    options.prefetchedData ??
    (await fetchSheetData({
      sheetId: options.sheetId,
      tabName,
      requestId: options.requestId,
      includeEmptyRows: true,
      retry: AUDIT_RETRY_POLICY,
    }));

  const resolvedHeaders = data.headers ?? [];
  const serialHeader = resolvedHeaders.find((header) => header.trim().toLowerCase() === "serial");
  if (!serialHeader) {
    throw new AppError({
      code: "INVALID_SYNC_CONFIGURATION",
      message: "Devices sheet must include a Serial column before running the audit",
    });
  }

  const mappedRows = mapRowMetadata(data.rows, data.rowMetadata ?? []);
  const missingRows: MissingSerialRow[] = mappedRows
    .filter(({ record }) => !hasSerialValue(record[serialHeader]))
    .map(({ record, rowNumber }) => ({
      rowNumber,
      serialValue: serializeValue(record[serialHeader]),
      row: Object.entries(record).reduce<Record<string, string | number | null>>((acc, [key, value]) => {
        acc[key] = serializeValue(value);
        return acc;
      }, {}),
    }));

  const completedAt = Date.now();
  const rowsAudited = mappedRows.length;
  const status: SerialAuditResult["status"] = missingRows.length > 0 ? "blocked" : "passed";

  const result: SerialAuditResult = {
    sheetId: options.sheetId,
    tabName,
    rowsAudited,
    missingSerialCount: missingRows.length,
    missingSerialRows: missingRows,
    status,
    startedAt: data.metrics?.startedAt ?? new Date(startedAt).toISOString(),
    completedAt: data.metrics?.completedAt ?? new Date(completedAt).toISOString(),
  };

  const truncatedRows = missingRows.slice(0, AUDIT_SKIPPED_ROW_SAMPLE_LIMIT);
  const persist = options.persist ?? true;
  if (persist) {
    await SyncEventModel.create({
      eventType: "SERIAL_AUDIT",
      route: options.source?.route ?? "workers/sync/audit",
      method: options.source?.method ?? "TASK",
      requestId: options.requestId,
      metadata: {
        sheetId: options.sheetId,
        tabName,
        rowsAudited,
        missingSerialCount: missingRows.length,
        skippedRows: truncatedRows,
        status,
        mode: options.mode ?? "live",
        trigger: options.trigger?.type ?? "system",
        requestedBy: options.trigger?.requestedBy ?? null,
      },
    });

    await recordAuditLogFromSyncEvent({
      eventType: "SERIAL_AUDIT",
      action: status === "blocked" ? "SERIAL_AUDIT_FAILED" : "SERIAL_AUDIT_PASSED",
      status: status === "blocked" ? "error" : "success",
      context: {
        sheetId: options.sheetId,
        tabName,
        rowsAudited,
        missingSerialCount: missingRows.length,
      },
    });
  }

  if (status === "blocked") {
    logger.warn(
      {
        event: "SERIAL_AUDIT_FAILURE",
        sheetId: options.sheetId,
        tabName,
        rowsAudited,
        missingSerialCount: missingRows.length,
        sample: truncatedRows,
        requestId: options.requestId ?? null,
      },
      "Serial audit detected missing serial values"
    );
  } else {
    logger.info(
      {
        event: "SERIAL_AUDIT_SUCCESS",
        sheetId: options.sheetId,
        tabName,
        rowsAudited,
        requestId: options.requestId ?? null,
      },
      "Serial audit completed"
    );
  }

  return result;
};

export const __testUtils = {
  hasSerialValue,
  serializeValue,
};
