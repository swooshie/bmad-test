import { JWT } from "google-auth-library";
import { GaxiosError, GaxiosResponse } from "gaxios";

import { logger } from "@/lib/logging";
import {
  getSheetsServiceAccount,
  SecretKey,
  SheetsServiceAccount,
} from "@/lib/secrets";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_TAB_NAME = "Devices";
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 50;

const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const NUMERIC_REGEX = /^[+-]?\d+(?:\.\d+)?$/;

type RawCell = string | number | null | undefined;

export type TypedCellValue = string | number | Date | null;

export type TypedRow = Record<string, TypedCellValue>;

export type SheetRowMetadata = {
  rowNumber: number;
  raw: RawCell[];
};

export type SheetErrorCode =
  | "SHEET_NOT_FOUND"
  | "RATE_LIMIT"
  | "OAUTH_REVOKED"
  | "INVALID_CONFIGURATION"
  | "UNKNOWN";

export type FetchMetrics = {
  durationMs: number;
  rowCount: number;
  pageCount: number;
  startedAt: string;
  completedAt: string;
  sheetId: string;
  tabName: string;
  requestId?: string;
  headerCount: number;
  retryCount: number;
};

export type RetryContext = {
  attempt: number;
  code: SheetErrorCode;
  delayMs: number;
  range: string;
};

export type RetryPolicy = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (context: RetryContext) => void | Promise<void>;
};

export const AUDIT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 750,
  maxDelayMs: 8000,
};

export const DEFAULT_SHEETS_TAB = DEFAULT_TAB_NAME;

export type CredentialSelector =
  | {
      mode?: "secret";
      secretKey?: Extract<SecretKey, "sheetsServiceAccount">;
      forceRefresh?: boolean;
    }
  | {
      mode: "inline";
      serviceAccount: SheetsServiceAccount;
    };

export type FetchSheetDataOptions = {
  sheetId: string;
  tabName?: string;
  credential?: CredentialSelector;
  requestId?: string;
  pageSize?: number;
  maxPages?: number;
  includeEmptyRows?: boolean;
  retry?: RetryPolicy;
  onPage?: (page: {
    index: number;
    raw: RawCell[][];
    records: TypedRow[];
    metadata: SheetRowMetadata[];
    startRowNumber: number;
  }) => void | Promise<void>;
};

export type SheetHeader = {
  name: string;
  normalizedName: string;
  position: number;
};

export type FetchSheetDataResult = {
  headers: string[];
  orderedHeaders: SheetHeader[];
  rows: TypedRow[];
  rowMetadata: SheetRowMetadata[];
  metrics: FetchMetrics;
};

export class SheetFetchError extends Error {
  constructor(
    public readonly code: SheetErrorCode,
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SheetFetchError";
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeTabName = (tabName?: string): string => {
  const trimmed = (tabName ?? DEFAULT_TAB_NAME).trim();
  if (!trimmed) {
    throw new SheetFetchError(
      "INVALID_CONFIGURATION",
      "Google Sheets tabName cannot be empty"
    );
  }
  return trimmed;
};

const normalizeSheetId = (sheetId: string | undefined): string => {
  const trimmed = sheetId?.trim();
  if (!trimmed) {
    throw new SheetFetchError(
      "INVALID_CONFIGURATION",
      "Google Sheets sheetId is required"
    );
  }
  return trimmed;
};

const normalizeHeaderLabel = (value: RawCell, position: number): string => {
  const asString = typeof value === "string" ? value : String(value ?? "");
  const trimmed = asString.trim();
  return trimmed.length > 0 ? trimmed : `column_${position}`;
};

const normalizeHeaderKey = (label: string, fallbackPosition: number): string => {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length > 0 ? slug : `column_${fallbackPosition}`;
};

const buildOrderedHeaders = (headers: string[]): SheetHeader[] =>
  headers.map((header, index) => ({
    name: header,
    normalizedName: normalizeHeaderKey(header, index + 1),
    position: index,
  }));

const createTrackedRetryPolicy = (
  policy: RetryPolicy | undefined,
  tracker: () => void
): RetryPolicy | undefined => {
  if (!policy) {
    return undefined;
  }
  const wrapped: RetryPolicy = {
    ...policy,
  };
  const originalOnRetry = wrapped.onRetry;
  wrapped.onRetry = async (context) => {
    tracker();
    await originalOnRetry?.(context);
  };
  return wrapped;
};

const resolveCredentials = async (
  selector?: CredentialSelector
): Promise<SheetsServiceAccount> => {
  if (!selector || selector.mode === "secret") {
    const secretKey = selector?.secretKey ?? "sheetsServiceAccount";
    if (secretKey !== "sheetsServiceAccount") {
      throw new SheetFetchError(
        "INVALID_CONFIGURATION",
        `Unsupported credential secret "${secretKey}".`
      );
    }
    return getSheetsServiceAccount({ forceRefresh: selector?.forceRefresh });
  }
  return selector.serviceAccount;
};

type RangeResponse = GaxiosResponse<{ values?: RawCell[][] }>;

const buildRangeSpecifier = (tabName: string, startRow: number, endRow: number) =>
  `${tabName}!${startRow}:${endRow}`;

const encodeRange = (range: string) => encodeURIComponent(range);

const toSheetFetchError = (error: unknown): SheetFetchError => {
  if (error instanceof SheetFetchError) {
    return error;
  }

  if (error instanceof GaxiosError) {
    return new SheetFetchError(
      mapStatusToCode(error.response?.status),
      error.message,
      error.response?.status,
      error
    );
  }

  const maybeStatus =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;

  return new SheetFetchError(
    mapStatusToCode(maybeStatus),
    error instanceof Error ? error.message : "Google Sheets fetch failed",
    maybeStatus,
    error
  );
};

const mapStatusToCode = (status?: number): SheetErrorCode => {
  if (!status) return "UNKNOWN";
  if (status === 404) return "SHEET_NOT_FOUND";
  if (status === 429) return "RATE_LIMIT";
  if (status === 401 || status === 403) return "OAUTH_REVOKED";
  if (status >= 400 && status < 500) return "INVALID_CONFIGURATION";
  return "UNKNOWN";
};

const isRetryable = (code: SheetErrorCode) =>
  code === "RATE_LIMIT" || code === "OAUTH_REVOKED" || code === "UNKNOWN";

const executeWithRetry = async <T>(
  executor: () => Promise<T>,
  policy: RetryPolicy | undefined,
  range: string
): Promise<T> => {
  const maxAttempts = Math.max(1, policy?.maxAttempts ?? 3);
  const baseDelay = Math.max(0, policy?.baseDelayMs ?? 400);
  const maxDelay = Math.max(baseDelay, policy?.maxDelayMs ?? 5000);

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await executor();
    } catch (error) {
      const sheetError = toSheetFetchError(error);
      if (!isRetryable(sheetError.code) || attempt >= maxAttempts) {
        throw sheetError;
      }

      const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
      logger.warn(
        {
          event: "SHEETS_FETCH_RETRY",
          attempt,
          delayMs: delay,
          code: sheetError.code,
          range,
        },
        "Retrying Google Sheets fetch after transient failure"
      );
      await policy?.onRetry?.({
        attempt,
        delayMs: delay,
        code: sheetError.code,
        range,
      });
      await wait(delay);
    }
  }

  throw new SheetFetchError("UNKNOWN", "Exceeded retry attempts");
};

const inferValue = (value: RawCell): TypedCellValue => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (NUMERIC_REGEX.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }
  }

  if (ISO_8601_REGEX.test(trimmed)) {
    const dateValue = new Date(trimmed);
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue;
    }
  }

  return trimmed;
};

const convertRowsToRecords = (
  headers: string[],
  rows: RawCell[][],
  includeEmptyRows: boolean,
  startRowNumber: number
): { records: TypedRow[]; metadata: SheetRowMetadata[] } => {
  const normalizedHeaders = headers.map((header, index) =>
    normalizeHeaderLabel(header, index + 1)
  );

  const records: TypedRow[] = [];
  const metadata: SheetRowMetadata[] = [];

  rows.forEach((row, rowIndex) => {
    const record: TypedRow = {};
    let meaningfulValueCount = 0;
    normalizedHeaders.forEach((header, columnIndex) => {
      const typedValue = inferValue(row[columnIndex]);
      record[header] = typedValue;
      if (typedValue !== null && typedValue !== "") {
        meaningfulValueCount += 1;
      }
    });

    const shouldInclude = includeEmptyRows || meaningfulValueCount > 0;
    if (shouldInclude) {
      records.push(record);
      metadata.push({
        rowNumber: startRowNumber + rowIndex,
        raw: row,
      });
    }
  });

  return { records, metadata };
};

const fetchRangeValues = async (
  client: JWT,
  sheetId: string,
  range: string,
  retry: RetryPolicy | undefined
): Promise<RawCell[][]> => {
  const response = await executeWithRetry(
    async () => {
      const requestUrl = `${SHEETS_BASE_URL}/${sheetId}/values/${encodeRange(range)}`;
      const result = await client.request<RangeResponse["data"]>({
        url: requestUrl,
        method: "GET",
        params: {
          majorDimension: "ROWS",
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING",
        },
      });
      return (result.data.values ?? []) as RawCell[][];
    },
    retry,
    range
  );
  return response;
};

export const fetchSheetData = async (
  options: FetchSheetDataOptions
): Promise<FetchSheetDataResult> => {
  const startedAt = Date.now();
  const sheetId = normalizeSheetId(options.sheetId);
  const tabName = normalizeTabName(options.tabName);
  const includeEmptyRows = Boolean(options.includeEmptyRows);
  const pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
  let retryCount = 0;
  const retryPolicy = createTrackedRetryPolicy(options.retry, () => {
    retryCount += 1;
  });

  const requestMetadata = {
    sheetId,
    tabName,
    requestId: options.requestId ?? null,
  };

  try {
    const credentials = await resolveCredentials(options.credential);
    const jwtClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [SHEETS_SCOPE],
      subject: credentials.client_email,
    });
    await jwtClient.authorize();

    logger.debug(
      {
        event: "SHEETS_FETCH_BEGIN",
        ...requestMetadata,
        pageSize,
        maxPages,
      },
      "Starting Google Sheets fetch"
    );

    const headersRange = buildRangeSpecifier(tabName, 1, 1);
    const headerValues = await fetchRangeValues(
      jwtClient,
      sheetId,
      headersRange,
      retryPolicy
    );
    const headers = (headerValues[0] ?? []).map((value, index) =>
      normalizeHeaderLabel(value, index + 1)
    );
    const orderedHeaders = buildOrderedHeaders(headers);

    const rows: TypedRow[] = [];
    const metadataRows: SheetRowMetadata[] = [];
    let pageCount = 0;
    let nextRowStart = 2;

    while (pageCount < maxPages) {
      const range = buildRangeSpecifier(
        tabName,
        nextRowStart,
        nextRowStart + pageSize - 1
      );
      const rawRows = await fetchRangeValues(jwtClient, sheetId, range, retryPolicy);
      if (!rawRows.length) {
        break;
      }

      const conversion = convertRowsToRecords(
        headers,
        rawRows,
        includeEmptyRows,
        nextRowStart
      );
      rows.push(...conversion.records);
      metadataRows.push(...conversion.metadata);
      await options.onPage?.({
        index: pageCount,
        raw: rawRows,
        records: conversion.records,
        metadata: conversion.metadata,
        startRowNumber: nextRowStart,
      });

      pageCount += 1;
      nextRowStart += pageSize;
      if (rawRows.length < pageSize) {
        break;
      }
    }

    const completedAt = Date.now();
    const metrics: FetchMetrics = {
      durationMs: completedAt - startedAt,
      rowCount: rows.length,
      pageCount,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      sheetId,
      tabName,
      requestId: options.requestId,
      headerCount: orderedHeaders.length,
      retryCount,
    };

    logger.info(
      {
        event: "SHEETS_FETCH_SUCCESS",
        ...metrics,
      },
      "Google Sheets fetch completed"
    );

    return {
      headers,
      orderedHeaders,
      rows,
      rowMetadata: metadataRows,
      metrics,
    };
  } catch (error) {
    const sheetError = toSheetFetchError(error);
    logger.error(
      {
        event: "SHEETS_FETCH_FAILURE",
        ...requestMetadata,
        code: sheetError.code,
        status: sheetError.status ?? null,
      },
      sheetError.message
    );
    throw sheetError;
  }
};

export const __testUtils = {
  inferValue,
  convertRowsToRecords,
  mapStatusToCode,
  isRetryable,
};
