import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  withSession:
    (handler: (request: any) => Promise<Response> | Response) =>
    (request: any) =>
      handler({
        ...request,
        session: { user: { email: "lead@nyu.edu" } },
      }),
}));

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: vi.fn(),
}));

const info = vi.fn();
const error = vi.fn();

vi.mock("@/lib/logging", () => ({
  __esModule: true,
  default: { info, error },
}));

const exec = vi.fn();
const chain = {
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  exec,
};

const find = vi.fn();

vi.mock("@/models/AuditLog", () => ({
  __esModule: true,
  default: { find },
}));

const buildRequest = (query: string) => ({
  nextUrl: new URL(`http://localhost/api/audit${query}`),
  headers: new Headers(),
});

describe("GET /api/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    find.mockReturnValue(chain);
  });

  it("returns audit events filtered by eventType", async () => {
    exec.mockResolvedValueOnce([
      {
        _id: "1",
        eventType: "sync",
        action: "SYNC_RUN",
        status: "success",
        actor: "lead@nyu.edu",
        errorCode: null,
        createdAt: new Date("2025-01-01T00:00:00Z"),
        context: { runId: "run-1" },
      },
    ]);

    const { GET } = await import("@/app/api/audit/route");
    const response = await GET(buildRequest("?eventType=sync&eventType=anonymization") as never);

    expect(find).toHaveBeenCalledWith({ eventType: { $in: ["sync", "anonymization"] } });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { events: Array<Record<string, unknown>> } };
    expect(payload.data.events[0]).toMatchObject({
      id: "1",
      eventType: "sync",
      action: "SYNC_RUN",
      status: "success",
      actor: "lead@nyu.edu",
      errorCode: null,
      context: { runId: "run-1" },
    });
  });

  it("applies deviceId filter when provided", async () => {
    exec.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/audit/route");

    await GET(buildRequest("?deviceId=device-1") as never);

    expect(find).toHaveBeenCalledWith({
      eventType: {
        $in: ["sync", "anonymization", "allowlist-change", "governance", "accessibility"],
      },
      $or: [{ "context.serial": "device-1" }, { "context.deviceId": "device-1" }],
    });
  });

  it("returns 500 when query fails", async () => {
    exec.mockRejectedValueOnce(new Error("db failure"));
    const { GET } = await import("@/app/api/audit/route");

    const response = await GET(buildRequest("") as never);

    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("AUDIT_FEED_FETCH_FAILED");
  });
});
