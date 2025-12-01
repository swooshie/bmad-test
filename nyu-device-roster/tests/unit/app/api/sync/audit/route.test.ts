import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  withSession:
    (handler: (request: Record<string, unknown>) => Promise<Response> | Response) =>
    (request: Record<string, unknown>) =>
      handler(request),
}));

const mockEnsureRuntimeConfig = vi.fn();

vi.mock("@/lib/config", () => ({
  ensureRuntimeConfig: mockEnsureRuntimeConfig,
  RuntimeConfigError: class RuntimeConfigError extends Error {},
}));

const connectToDatabase = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: connectToDatabase,
}));

const mockRunSerialAudit = vi.fn();

vi.mock("@/workers/sync/audit", () => ({
  runSerialAudit: mockRunSerialAudit,
}));

const loggerInfo = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/logging", () => ({
  logger: {
    info: loggerInfo,
    error: loggerError,
  },
}));

describe("POST /api/sync/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureRuntimeConfig.mockResolvedValue({
      config: {
        devicesSheetId: "sheet-123",
      },
      secrets: {},
    });
    mockRunSerialAudit.mockResolvedValue({
      sheetId: "sheet-123",
      tabName: "Devices",
      rowsAudited: 2,
      missingSerialCount: 0,
      missingSerialRows: [],
      status: "passed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
  });

  const buildRequest = (overrides?: { headers?: Record<string, string>; email?: string }) => ({
    headers: {
      get: (key: string) => overrides?.headers?.[key.toLowerCase()] ?? null,
    },
    session: {
      user: {
        email: overrides?.email ?? "ops@nyu.edu",
      },
    },
  });

  it("returns audit summary when successful", async () => {
    const { POST } = await import("@/app/api/sync/audit/route");
    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: expect.objectContaining({ rowsAudited: 2, status: "passed" }),
      error: null,
    });
    expect(mockRunSerialAudit).toHaveBeenCalledWith(
      expect.objectContaining({ sheetId: "sheet-123", mode: "dry-run" })
    );
    expect(loggerInfo).toHaveBeenCalled();
  });

  it("returns 503 when runtime config is missing", async () => {
    const { RuntimeConfigError } = await import("@/lib/config");
    mockEnsureRuntimeConfig.mockRejectedValueOnce(
      new RuntimeConfigError("missing", "CONFIG_MISSING")
    );

    const { POST } = await import("@/app/api/sync/audit/route");
    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(503);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: null,
      error: expect.objectContaining({ code: "CONFIG_MISSING" }),
    });
  });

  it("bubbles up audit failures", async () => {
    const { AppError } = await import("@/lib/errors/app-error");
    mockRunSerialAudit.mockRejectedValueOnce(
      new AppError({ code: "INVALID_SYNC_CONFIGURATION", message: "no serial" })
    );

    const { POST } = await import("@/app/api/sync/audit/route");
    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      data: null,
      error: expect.objectContaining({ code: "INVALID_SYNC_CONFIGURATION" }),
    });
    expect(loggerError).toHaveBeenCalled();
  });
});
