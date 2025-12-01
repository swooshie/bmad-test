import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchSheetData = vi.fn();

vi.mock("@/lib/google-sheets", () => ({
  fetchSheetData: mockFetchSheetData,
}));

const mockNormalizeRows = vi.fn();

vi.mock("@/workers/sync/transform", () => ({
  normalizeSheetRows: mockNormalizeRows,
}));

const mockRunSerialAudit = vi.fn();

vi.mock("@/workers/sync/audit", () => ({
  runSerialAudit: mockRunSerialAudit,
  AUDIT_SKIPPED_ROW_SAMPLE_LIMIT: 25,
}));

const mockConnectToDatabase = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockConnectToDatabase,
}));

const recordAuditLogFromSyncEvent = vi.fn();

vi.mock("@/lib/audit/auditLogs", () => ({
  recordAuditLogFromSyncEvent,
}));

const mockDeviceFindLean = vi.fn();
const mockDeviceFind = vi.fn(() => ({ lean: mockDeviceFindLean, session: vi.fn().mockReturnThis() }));
const mockDeviceBulkWrite = vi.fn();

vi.mock("@/models/Device", () => ({
  __esModule: true,
  default: {
    find: mockDeviceFind,
    bulkWrite: mockDeviceBulkWrite,
  },
}));

const mockColumnFind = vi.fn(() => ({
  session: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue([]),
}));
const mockColumnBulkWrite = vi.fn();

vi.mock("@/models/ColumnDefinition", () => ({
  __esModule: true,
  default: {
    find: mockColumnFind,
    bulkWrite: mockColumnBulkWrite,
  },
}));

const mockSyncEventCreate = vi.fn();

vi.mock("@/models/SyncEvent", () => ({
  __esModule: true,
  default: {
    create: mockSyncEventCreate,
  },
}));

const mockWithTransaction = vi.fn(async (fn: () => Promise<void>) => {
  await fn();
});
const mockEndSession = vi.fn();
const mockStartSession = vi.fn(async () => ({
  withTransaction: mockWithTransaction,
  endSession: mockEndSession,
}));

vi.mock("mongoose", async () => {
  const actual = (await vi.importActual<typeof import("mongoose")>("mongoose")) as typeof import("mongoose");
  const mockedDefault = (actual as typeof import("mongoose") & {
    default?: typeof import("mongoose");
  }).default ?? actual;
  mockedDefault.startSession = mockStartSession;
  return {
    ...actual,
    default: mockedDefault,
    startSession: mockStartSession,
    models: actual.models ?? mockedDefault.models,
  };
});

const logSyncRunStarted = vi.fn();
const logSyncRunCompleted = vi.fn();

vi.mock("@/lib/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  logSyncRunStarted,
  logSyncRunCompleted,
}));

describe("runDeviceSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSheetData.mockResolvedValue({
      rows: [{ deviceId: "dev-1", status: "Assigned" }],
      headers: ["serial", "deviceId", "status"],
      rowMetadata: [{ rowNumber: 2, raw: [] }],
      metrics: {
        durationMs: 10,
        rowCount: 1,
        pageCount: 1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        sheetId: "sheet-123",
        tabName: "Devices",
      },
    });
    mockRunSerialAudit.mockResolvedValue({
      sheetId: "sheet-123",
      tabName: "Devices",
      rowsAudited: 1,
      missingSerialCount: 0,
      missingSerialRows: [],
      status: "passed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    mockNormalizeRows.mockReturnValue({
      devices: [
        {
          serial: "dev-1",
          deviceId: "dev-1",
          sheetId: "sheet-123",
          assignedTo: "User",
          status: "Assigned",
          condition: "Good",
          offboardingStatus: undefined,
          lastSeen: undefined,
          lastSyncedAt: new Date(),
          contentHash: "hash",
        },
      ],
      rowCount: 1,
      skipped: 0,
      anomalies: [],
    });
    mockDeviceFindLean.mockResolvedValue([]);
    mockDeviceBulkWrite.mockResolvedValue(undefined);
    mockSyncEventCreate.mockResolvedValue(undefined);
  });

  it("records scheduled trigger metadata in sync events", async () => {
    const { runDeviceSync } = await import("@/workers/sync");
    const result = await runDeviceSync({
      sheetId: "sheet-123",
      trigger: { type: "scheduled", requestedBy: "scheduler", anonymized: false },
      runId: "run-test",
      requestId: "req-1",
    });

    expect(result.rowCount).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(mockDeviceFind).toHaveBeenCalledWith({
      sheetId: "sheet-123",
      serial: { $in: ["dev-1"] },
    });
    const syncEventArgs = mockSyncEventCreate.mock.calls.find(
      ([payload]) => payload.eventType === "SYNC_RUN"
    );
    expect(syncEventArgs?.[0]).toMatchObject({
      metadata: expect.objectContaining({
        trigger: "scheduled",
        status: "success",
        rowCount: 1,
        requestedBy: "scheduler",
        rowsAudited: 1,
        missingSerialCount: 0,
        rowsProcessed: 1,
        rowsSkipped: 0,
        conflicts: 0,
        startedAt: expect.any(String),
        completedAt: expect.any(String),
        schemaChange: expect.objectContaining({
          added: expect.any(Array),
          removed: expect.any(Array),
          renamed: expect.any(Array),
          currentVersion: expect.any(String),
        }),
        mode: "live",
      }),
    });
  });

  it("skips persistence but emits telemetry in dry-run mode", async () => {
    const { runDeviceSync } = await import("@/workers/sync");
    const result = await runDeviceSync({
      sheetId: "sheet-123",
      trigger: { type: "manual", requestedBy: "manager", anonymized: false, mode: "dry-run" },
      mode: "dry-run",
      runId: "run-dry",
    });

    expect(mockDeviceBulkWrite).not.toHaveBeenCalled();
    expect(mockColumnBulkWrite).not.toHaveBeenCalled();
    expect(mockStartSession).not.toHaveBeenCalled();
    expect(result.upsert.added).toBeGreaterThan(0);
    expect(result.schemaChange?.mode).toBe("dry-run");
  });

  it("short-circuits when serial audit finds missing serials", async () => {
    const { runDeviceSync } = await import("@/workers/sync");
    mockRunSerialAudit.mockResolvedValueOnce({
      sheetId: "sheet-123",
      tabName: "Devices",
      rowsAudited: 2,
      missingSerialCount: 2,
      missingSerialRows: [
        { rowNumber: 2, serialValue: null, row: { serial: null, deviceId: "dev-1" } },
      ],
      status: "blocked",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    await expect(
      runDeviceSync({
        sheetId: "sheet-123",
        trigger: { type: "scheduled", requestedBy: "scheduler", anonymized: false },
      })
    ).rejects.toMatchObject({ code: "SERIAL_AUDIT_FAILED" });

    const skipEvent = mockSyncEventCreate.mock.calls.find(
      ([payload]) => payload.eventType === "SYNC_RUN"
    );
    expect(skipEvent?.[0]).toMatchObject({
      metadata: expect.objectContaining({
        status: "skipped",
        reason: "serial_audit_blocked",
        missingSerialCount: 2,
        rowsProcessed: 1,
        rowsSkipped: 1,
        startedAt: expect.any(String),
        completedAt: expect.any(String),
      }),
    });
    expect(mockDeviceBulkWrite).not.toHaveBeenCalled();
  });
});
