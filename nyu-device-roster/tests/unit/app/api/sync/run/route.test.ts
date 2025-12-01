import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnsureRuntimeConfig = vi.fn();

vi.mock("@/lib/config", () => ({
  ensureRuntimeConfig: mockEnsureRuntimeConfig,
  RuntimeConfigError: class RuntimeConfigError extends Error {},
}));

const recordAuditLogFromSyncEvent = vi.fn();

vi.mock("@/lib/audit/auditLogs", () => ({
  recordAuditLogFromSyncEvent,
}));

const mockRunDeviceSync = vi.fn();

vi.mock("@/workers/sync", () => ({
  runDeviceSync: mockRunDeviceSync,
}));

const markSyncRunning = vi.fn();
const markSyncSuccess = vi.fn();
const markSyncError = vi.fn();

vi.mock("@/lib/sync-status", () => ({
  markSyncRunning,
  markSyncSuccess,
  markSyncError,
}));

const mockAcquireSyncLock = vi.fn();
const mockReleaseSyncLock = vi.fn();

vi.mock("@/lib/sync-lock", () => ({
  acquireSyncLock: mockAcquireSyncLock,
  releaseSyncLock: mockReleaseSyncLock,
}));

const mockLean = vi.fn();
const mockSort = vi.fn(() => ({ lean: mockLean }));
const mockFindOne = vi.fn(() => ({ sort: mockSort }));
const mockCreate = vi.fn();

vi.mock("@/models/SyncEvent", () => ({
  __esModule: true,
  default: {
    findOne: mockFindOne,
    create: mockCreate,
  },
}));

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue(undefined),
}));

const loggerWarn = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/logging", () => ({
  logger: {
    warn: loggerWarn,
    error: loggerError,
  },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "run-mock-id",
}));

const buildRequest = (overrides?: { headers?: Record<string, string> }) => {
  const headers = overrides?.headers ?? {};
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  };
};

describe("POST /api/sync/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureRuntimeConfig.mockResolvedValue({
      config: {
        devicesSheetId: "sheet-123",
        sync: {
          enabled: true,
          intervalMinutes: 2,
          timezone: "Etc/UTC",
        },
      },
      secrets: {
        syncSchedulerToken: "scheduler-token",
      },
    });
    mockRunDeviceSync.mockResolvedValue({
      upsert: {
        added: 1,
        updated: 1,
        unchanged: 0,
        durationMs: 450,
        serialConflicts: 0,
        legacyIdsUpdated: 0,
      },
      durationMs: 450,
      sheetId: "sheet-123",
      rowCount: 2,
      skipped: 0,
      anomalies: [],
      columnRegistry: { added: 0, removed: 0, total: 0 },
      columnRegistryVersion: "v1",
    });
    mockAcquireSyncLock.mockResolvedValue({
      acquired: true,
      lock: {
        key: "device-sync",
        locked: true,
        lockId: "run-mock-id",
        lockedAt: new Date("2025-01-01T00:00:00Z"),
      },
    });
    mockReleaseSyncLock.mockResolvedValue(undefined);
    mockLean.mockResolvedValue(null);
  });

  const cronHeaders = {
    "x-appengine-cron": "true",
    "x-internal-service-token": "scheduler-token",
  };

  it("queues scheduled sync when headers are valid", async () => {
    const { POST } = await import("@/app/api/sync/run/route");

    const response = await POST(buildRequest({ headers: cronHeaders }) as never);

    expect(response.status).toBe(202);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: {
        status: "running",
        trigger: "scheduled",
        runId: "run-mock-id",
        sheetId: "sheet-123",
        requestedBy: "scheduler",
      },
      error: null,
    });

    expect(markSyncRunning).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-mock-id",
        requestedBy: "scheduler",
        trigger: "scheduled",
        mode: "live",
      })
    );
    expect(mockRunDeviceSync).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetId: "sheet-123",
        trigger: expect.objectContaining({ type: "scheduled" }),
      })
    );

    await Promise.resolve();
    expect(markSyncSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-mock-id",
        requestedBy: "scheduler",
        trigger: "scheduled",
        metrics: expect.objectContaining({
          rowsProcessed: 2,
          rowsSkipped: 0,
          conflicts: 0,
        }),
      })
    );
    expect(mockReleaseSyncLock).toHaveBeenCalledWith("run-mock-id");
  });

  it("rejects requests with missing scheduler headers", async () => {
    const { POST } = await import("@/app/api/sync/run/route");

    const response = await POST(
      buildRequest({
        headers: {
          "x-appengine-cron": "true",
        },
      }) as never
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      data: null,
      error: expect.objectContaining({ code: "UNAUTHORIZED_CRON" }),
    });
    expect(markSyncRunning).not.toHaveBeenCalled();
    expect(mockRunDeviceSync).not.toHaveBeenCalled();
  });

  it("skips execution when sync.enabled is false", async () => {
    mockEnsureRuntimeConfig.mockResolvedValueOnce({
      config: {
        devicesSheetId: "sheet-123",
        sync: {
          enabled: false,
          intervalMinutes: 2,
          timezone: "Etc/UTC",
        },
      },
      secrets: {
        syncSchedulerToken: "scheduler-token",
      },
    });

    const { POST } = await import("@/app/api/sync/run/route");
    const response = await POST(buildRequest({ headers: cronHeaders }) as never);

    expect(response.status).toBe(202);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: { status: "skipped", reason: "config_disabled" },
      error: null,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: "config_disabled" }),
      })
    );
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
  });

  it("skips when cadence window has not elapsed", async () => {
    mockLean.mockResolvedValueOnce({
      createdAt: new Date(),
    });

    const { POST } = await import("@/app/api/sync/run/route");
    const response = await POST(buildRequest({ headers: cronHeaders }) as never);

    expect(response.status).toBe(202);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: expect.objectContaining({ reason: "cadence_window" }),
      error: null,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: "cadence_window" }),
      })
    );
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
  });

  it("skips when a previous run is still in-flight", async () => {
    mockAcquireSyncLock.mockResolvedValueOnce({
      acquired: false,
      lock: {
        key: "device-sync",
        locked: true,
        lockId: "other-lock",
        lockedAt: new Date("2025-01-01T00:00:00Z"),
      },
    });

    const { POST } = await import("@/app/api/sync/run/route");
    const response = await POST(buildRequest({ headers: cronHeaders }) as never);

    expect(response.status).toBe(202);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: { status: "skipped", reason: "inflight" },
      error: null,
    });
    expect(mockRunDeviceSync).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: "inflight" }),
      })
    );
  });

  it("records failure event when worker throws", async () => {
    mockRunDeviceSync.mockRejectedValueOnce(new Error("boom"));

    const { POST } = await import("@/app/api/sync/run/route");
    const response = await POST(buildRequest({ headers: cronHeaders }) as never);
    expect(response.status).toBe(202);

    await Promise.resolve();
    await Promise.resolve();
    expect(markSyncError).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-mock-id",
        errorCode: "MONGO_WRITE_FAILED",
        recommendation: expect.stringContaining("Mongo"),
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          status: "failed",
          runId: "run-mock-id",
          errorCode: "MONGO_WRITE_FAILED",
        }),
      })
    );
  });
});
