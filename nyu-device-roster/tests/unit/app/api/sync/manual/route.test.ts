import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  withSession:
    (handler: (request: unknown) => Promise<Response> | Response) =>
    (request: unknown) =>
      handler(request),
}));

const mockEnsureRuntimeConfig = vi.fn();

vi.mock("@/lib/config", () => ({
  ensureRuntimeConfig: mockEnsureRuntimeConfig,
  RuntimeConfigError: class RuntimeConfigError extends Error {},
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

const loggerError = vi.fn();

vi.mock("@/lib/logging", () => ({
  logger: {
    error: loggerError,
  },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "run-mock-id",
}));

const buildRequest = (overrides?: {
  headers?: Record<string, string>;
  sessionEmail?: string | null;
}) => {
  const headers = overrides?.headers ?? {};
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    session: {
      user: {
        email: overrides?.sessionEmail ?? "lead@nyu.edu",
      },
    },
  };
};

describe("POST /api/sync/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureRuntimeConfig.mockResolvedValue({
      config: {
        devicesSheetId: "sheet-123",
      },
      secrets: {},
    });
  });

  it("queues manual sync and returns optimistic response", async () => {
    mockRunDeviceSync.mockResolvedValue({
      upsert: {
        added: 1,
        updated: 2,
        unchanged: 3,
        durationMs: 500,
        runId: "run-mock-id",
        anomalies: [],
      },
      sheetId: "sheet-123",
      rowCount: 6,
      skipped: 0,
      anomalies: [],
      durationMs: 500,
    });

    const { POST } = await import("@/app/api/sync/manual/route");
    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(202);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: {
        runId: "run-mock-id",
        status: "running",
        requestedBy: "lead@nyu.edu",
        sheetId: "sheet-123",
      },
      error: null,
    });

    expect(markSyncRunning).toHaveBeenCalledWith({
      runId: "run-mock-id",
      requestedBy: "lead@nyu.edu",
    });
    expect(mockRunDeviceSync).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetId: "sheet-123",
        runId: "run-mock-id",
        trigger: expect.objectContaining({
          type: "manual",
          requestedBy: "lead@nyu.edu",
        }),
      })
    );

    await Promise.resolve();
    expect(markSyncSuccess).toHaveBeenCalledWith({
      runId: "run-mock-id",
      metrics: expect.objectContaining({ added: 1, durationMs: 500 }),
    });
  });

  it("records sync errors when worker fails", async () => {
    const { SheetFetchError } = await import("@/lib/google-sheets");
    mockRunDeviceSync.mockRejectedValue(
      new SheetFetchError("RATE_LIMIT", "Sheets API rate limited", 429)
    );

    const { POST } = await import("@/app/api/sync/manual/route");
    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(202);

    await Promise.resolve();
    expect(markSyncError).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-mock-id",
        errorCode: "RATE_LIMIT",
      })
    );
  });

  it("returns 503 when runtime config is missing", async () => {
    const { RuntimeConfigError } = await import("@/lib/config");
    mockEnsureRuntimeConfig.mockRejectedValueOnce(
      new RuntimeConfigError("Configuration missing", "CONFIG_MISSING")
    );

    const { POST } = await import("@/app/api/sync/manual/route");
    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(503);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      data: null,
      error: { code: "CONFIG_MISSING" },
    });
    expect(markSyncRunning).not.toHaveBeenCalled();
    expect(mockRunDeviceSync).not.toHaveBeenCalled();
  });
});
