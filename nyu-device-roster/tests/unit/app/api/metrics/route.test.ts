import { beforeEach, describe, expect, it, vi } from "vitest";

const logPerformanceMetric = vi.fn();
const connectToDatabase = vi.fn();
const recordAuditLog = vi.fn();
const aggregateMetrics = vi.fn();

let currentSession: { user?: { email?: string | null; managerRole?: string | null } } = {
  user: { email: "lead@example.com", managerRole: "lead" },
};

vi.mock("@/lib/logging", () => ({
  logPerformanceMetric,
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  __esModule: true,
  withSession:
    (handler: (request: any) => Promise<Response> | Response) => (request?: Request) =>
      handler(Object.assign(request ?? new Request("http://localhost/api/metrics"), { session: currentSession })),
}));

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: connectToDatabase,
}));

vi.mock("@/lib/metrics/syncAggregations", () => ({
  aggregateSyncMetrics: aggregateMetrics,
}));

vi.mock("@/lib/audit/auditLogs", () => ({
  recordAuditLog,
}));

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/metrics", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/metrics", () => {
  beforeEach(() => {
    logPerformanceMetric.mockClear();
  });

  it("rejects an invalid payload", async () => {
    const { POST } = await import("@/app/api/metrics/route");

    const response = await POST(
      buildRequest({
        metrics: [{ metric: "INP", value: "oops" }],
      }) as Request
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("INVALID_METRIC_PAYLOAD");
    expect(logPerformanceMetric).not.toHaveBeenCalled();
  });

  it("logs metrics and returns the recorded count", async () => {
    const { POST } = await import("@/app/api/metrics/route");

    const response = await POST(
      buildRequest({
        requestId: "req-123",
        anonymized: true,
        metrics: [{ metric: "FCP", value: 123, threshold: 200 }],
      }) as Request
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { count: number } };
    expect(payload.data.count).toBe(1);
    expect(logPerformanceMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "FCP",
        value: 123,
        requestId: "req-123",
        anonymized: true,
      })
    );
  });
});

describe("GET /api/metrics", () => {
  beforeEach(() => {
    aggregateMetrics.mockReset();
    connectToDatabase.mockResolvedValue(undefined);
    recordAuditLog.mockReset();
    currentSession = { user: { email: "lead@example.com", managerRole: "lead" } };
  });

  it("enforces manager or lead access", async () => {
    currentSession = { user: { email: "viewer@example.com", managerRole: null } };
    const { GET } = await import("@/app/api/metrics/route");

    const response = await GET(new Request("http://localhost/api/metrics") as never);

    expect(response.status).toBe(403);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", errorCode: "FORBIDDEN" })
    );
    expect(aggregateMetrics).not.toHaveBeenCalled();
  });

  it("returns aggregated sync metrics for last12h and cumulative windows", async () => {
    const aggregatePayload = [
      {
        perTrigger: [
          {
            trigger: "manual",
            runs: 2,
            success: 2,
            failure: 0,
            totalDurationMs: 300,
            avgDurationMs: 150,
            totalRows: 40,
          },
        ],
        totals: [
          {
            runs: 2,
            success: 2,
            failure: 0,
            totalDurationMs: 300,
            avgDurationMs: 150,
            totalRows: 40,
          },
        ],
      },
    ];

    aggregateMetrics.mockResolvedValueOnce({
      perTrigger: aggregatePayload[0].perTrigger,
      totals: aggregatePayload[0].totals[0],
    });
    aggregateMetrics.mockResolvedValueOnce({
      perTrigger: aggregatePayload[0].perTrigger,
      totals: aggregatePayload[0].totals[0],
    });

    const { GET } = await import("@/app/api/metrics/route");
    const response = await GET(new Request("http://localhost/api/metrics") as never);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        last12h: { totals: { runs: number }; perTrigger: Array<{ trigger: string }> };
        cumulative: { totals: { runs: number } };
        webhook: { enabled: boolean };
      };
    };

    expect(payload.data.last12h.totals.runs).toBe(2);
    expect(payload.data.last12h.perTrigger[0].trigger).toBe("manual");
    expect(payload.data.cumulative.totals.success).toBe(2);
    expect(payload.data.webhook.enabled).toBe(false);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", action: "METRICS_FETCH" })
    );
    expect(aggregateMetrics).toHaveBeenCalledTimes(2);
  });
});
