import { describe, expect, it, vi, beforeEach } from "vitest";

const logPerformanceMetric = vi.fn();

vi.mock("@/lib/logging", () => ({
  logPerformanceMetric,
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
