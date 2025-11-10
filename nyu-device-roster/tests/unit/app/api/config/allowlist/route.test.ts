import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  withSession:
    (handler: (request: unknown) => Promise<Response> | Response) =>
    (request: unknown) =>
      handler(request),
}));

const mockLoadConfig = vi.fn();
const mockUpsertConfig = vi.fn();

vi.mock("@/lib/config", () => ({
  __esModule: true,
  default: mockLoadConfig,
  upsertConfig: mockUpsertConfig,
}));

const logAllowlistEndpointEvent = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/logging", () => ({
  __esModule: true,
  default: {
    error: loggerError,
  },
  logAllowlistEndpointEvent,
}));

const recordAllowlistChangeEvent = vi.fn();
const recordAllowlistAccessDeniedEvent = vi.fn();

vi.mock("@/lib/audit/syncEvents", () => ({
  recordAllowlistChangeEvent,
  recordAllowlistAccessDeniedEvent,
}));

const buildRequest = (overrides?: {
  method?: string;
  session?: { user?: { email?: string | null; managerRole?: string | null } };
  headers?: Record<string, string>;
  body?: unknown;
  jsonShouldThrow?: boolean;
}) => {
  const headerBag = overrides?.headers ?? {};
  const headers = {
    get: (key: string) => headerBag[key.toLowerCase()] ?? null,
  };

  return {
    method: overrides?.method ?? "GET",
    headers,
    nextUrl: { pathname: "/api/config/allowlist" },
    session: overrides?.session ?? {
      user: { email: "lead@nyu.edu", managerRole: "lead" },
    },
    json: overrides?.jsonShouldThrow
      ? async () => {
          throw new Error("bad json");
        }
      : async () => overrides?.body ?? {},
  };
};

describe("/api/config/allowlist route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when managerRole is not lead", async () => {
    const { GET } = await import("@/app/api/config/allowlist/route");
    const request = buildRequest({
      session: { user: { email: "manager@nyu.edu", managerRole: "manager" } },
    });

    const response = await GET(request as never);
    expect(response.status).toBe(403);
    expect(recordAllowlistAccessDeniedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "LEAD_ROLE_REQUIRED",
        userEmail: "manager@nyu.edu",
      })
    );
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it("returns allowlist snapshot for lead manager GET requests", async () => {
    const { GET } = await import("@/app/api/config/allowlist/route");
    mockLoadConfig.mockResolvedValueOnce({
      allowlist: ["lead@nyu.edu", "manager@nyu.edu"],
      lastUpdatedAt: new Date("2025-01-01T00:00:00Z"),
      updatedBy: "lead@nyu.edu",
    });

    const response = await GET(buildRequest() as never);

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      allowlist: ["lead@nyu.edu", "manager@nyu.edu"],
      diff: { added: [], removed: [], unchanged: ["lead@nyu.edu", "manager@nyu.edu"] },
      metadata: {
        updatedBy: "lead@nyu.edu",
        lastUpdatedAt: "2025-01-01T00:00:00.000Z",
      },
    });
    expect(logAllowlistEndpointEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "granted" })
    );
  });

  it("returns 400 when PUT body is invalid JSON", async () => {
    const { PUT } = await import("@/app/api/config/allowlist/route");
    const response = await PUT(
      buildRequest({
        method: "PUT",
        jsonShouldThrow: true,
      }) as never
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.errorCode).toBe("INVALID_JSON");
  });

  it("returns 400 when PUT payload contains non-nyu emails", async () => {
    const { PUT } = await import("@/app/api/config/allowlist/route");
    mockLoadConfig.mockResolvedValueOnce({
      allowlist: ["lead@nyu.edu"],
      devicesSheetId: "sheet",
      collectionName: "config",
      lastUpdatedAt: new Date(),
      updatedBy: "lead@nyu.edu",
    });

    const response = await PUT(
      buildRequest({
        method: "PUT",
        body: { emails: ["user@example.com"] },
      }) as never
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.errorCode).toBe("INVALID_ALLOWLIST");
    expect(mockUpsertConfig).not.toHaveBeenCalled();
  });

  it("persists allowlist updates and logs audit trail", async () => {
    const { PUT } = await import("@/app/api/config/allowlist/route");
    mockLoadConfig.mockResolvedValue({
      allowlist: ["lead@nyu.edu"],
      devicesSheetId: "sheet",
      collectionName: "config",
      lastUpdatedAt: new Date("2025-01-01T00:00:00Z"),
      updatedBy: "lead@nyu.edu",
    });

    mockUpsertConfig.mockResolvedValue({
      config: {
        allowlist: ["lead@nyu.edu", "new@nyu.edu"],
        lastUpdatedAt: new Date("2025-01-02T00:00:00Z"),
        updatedBy: "lead@nyu.edu",
      },
      diff: {
        added: ["new@nyu.edu"],
        removed: [],
        unchanged: ["lead@nyu.edu"],
      },
    });

    const response = await PUT(
      buildRequest({
        method: "PUT",
        body: { emails: ["lead@nyu.edu", "new@nyu.edu"] },
      }) as never
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.diff).toEqual({
      added: ["new@nyu.edu"],
      removed: [],
      unchanged: ["lead@nyu.edu"],
    });
    expect(mockUpsertConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        allowlist: ["lead@nyu.edu", "new@nyu.edu"],
        source: "admin-endpoint",
      })
    );
    expect(recordAllowlistChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: {
          added: ["new@nyu.edu"],
          removed: [],
          unchanged: ["lead@nyu.edu"],
        },
      })
    );
    expect(logAllowlistEndpointEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "granted", diff: expect.any(Object) })
    );
  });
});
