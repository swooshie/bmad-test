import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchSheetData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/google-sheets", () => ({
  fetchSheetData: mockFetchSheetData,
  AUDIT_RETRY_POLICY: {},
  DEFAULT_SHEETS_TAB: "Devices",
}));

const syncEventCreate = vi.hoisted(() => vi.fn());

vi.mock("@/models/SyncEvent", () => ({
  __esModule: true,
  default: {
    create: syncEventCreate,
  },
}));

const recordAuditLogFromSyncEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audit/auditLogs", () => ({
  recordAuditLogFromSyncEvent,
}));

const { loggerWarn, loggerInfo } = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logger: {
    warn: loggerWarn,
    info: loggerInfo,
  },
}));

import { AppError } from "@/lib/errors/app-error";
import { runSerialAudit } from "@/workers/sync/audit";

describe("runSerialAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSheetData.mockResolvedValue({
      headers: ["serial", "deviceId", "owner"],
      rows: [
        { serial: "dev-1", deviceId: "dev-1", owner: "Ops" },
        { serial: null, deviceId: "dev-2", owner: "" },
      ],
      rowMetadata: [
        { rowNumber: 2, raw: [] },
        { rowNumber: 3, raw: [] },
      ],
      metrics: {
        durationMs: 5,
        rowCount: 2,
        pageCount: 1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        sheetId: "sheet-1",
        tabName: "Devices",
      },
    });
  });

  it("records telemetry and returns missing serial rows", async () => {
    const result = await runSerialAudit({
      sheetId: "sheet-1",
      requestId: "req-1",
      trigger: { type: "manual", requestedBy: "ops@nyu.edu", anonymized: false },
      mode: "dry-run",
      source: { route: "/api/sync/audit", method: "POST" },
    });

    expect(result.missingSerialCount).toBe(1);
    expect(result.status).toBe("blocked");
    expect(result.missingSerialRows[0]).toMatchObject({
      rowNumber: 3,
      row: expect.objectContaining({ deviceId: "dev-2" }),
    });

    expect(syncEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SERIAL_AUDIT",
        metadata: expect.objectContaining({
          rowsAudited: 2,
          missingSerialCount: 1,
          skippedRows: expect.any(Array),
        }),
      })
    );
    expect(recordAuditLogFromSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SERIAL_AUDIT_FAILED",
        context: expect.objectContaining({ missingSerialCount: 1 }),
      })
    );
    expect(loggerWarn).toHaveBeenCalled();
  });

  it("skips persistence when persist=false", async () => {
    const result = await runSerialAudit({
      sheetId: "sheet-1",
      persist: false,
    });

    expect(result.rowsAudited).toBe(2);
    expect(syncEventCreate).not.toHaveBeenCalled();
    expect(recordAuditLogFromSyncEvent).not.toHaveBeenCalled();
  });

  it("throws when the Serial column is missing", async () => {
    mockFetchSheetData.mockResolvedValueOnce({
      headers: ["deviceId"],
      rows: [],
      rowMetadata: [],
      metrics: {
        durationMs: 1,
        rowCount: 0,
        pageCount: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        sheetId: "sheet-1",
        tabName: "Devices",
      },
    });

    await expect(runSerialAudit({ sheetId: "sheet-1" })).rejects.toBeInstanceOf(AppError);
  });
});
