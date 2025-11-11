import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchSheetData = vi.fn();

vi.mock("@/lib/google-sheets", () => ({
  fetchSheetData: mockFetchSheetData,
}));

const mockNormalizeRows = vi.fn();

vi.mock("@/workers/sync/transform", () => ({
  normalizeSheetRows: mockNormalizeRows,
}));

const mockConnectToDatabase = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockConnectToDatabase,
}));

const mockDeviceFindLean = vi.fn();
const mockDeviceFind = vi.fn(() => ({ lean: mockDeviceFindLean }));
const mockDeviceBulkWrite = vi.fn();

vi.mock("@/models/Device", () => ({
  __esModule: true,
  default: {
    find: mockDeviceFind,
    bulkWrite: mockDeviceBulkWrite,
  },
}));

const mockSyncEventCreate = vi.fn();

vi.mock("@/models/SyncEvent", () => ({
  __esModule: true,
  default: {
    create: mockSyncEventCreate,
  },
}));

vi.mock("@/lib/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("runDeviceSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSheetData.mockResolvedValue({
      rows: [{ deviceId: "dev-1", status: "Assigned" }],
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
    mockNormalizeRows.mockReturnValue({
      devices: [
        {
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
      deviceId: { $in: ["dev-1"] },
    });
    expect(mockSyncEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          trigger: "scheduled",
          status: "success",
          rowCount: 1,
          requestedBy: "scheduler",
        }),
      })
    );
  });
});
