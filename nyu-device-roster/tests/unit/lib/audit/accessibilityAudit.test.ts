import { afterEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("@/lib/audit/auditLogs", () => ({
  recordAuditLog: vi.fn(),
}));

import { recordAccessibilityAuditLog } from "@/lib/audit/accessibilityAudit";
import { recordAuditLog } from "@/lib/audit/auditLogs";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordAccessibilityAuditLog", () => {
  it("records a pass result with success status", async () => {
    const recordSpy = recordAuditLog as MockedFunction<typeof recordAuditLog>;
    recordSpy.mockResolvedValue();

    await recordAccessibilityAuditLog({
      tool: "axe",
      target: "/devices",
      result: "pass",
      tester: "qa@example.com",
      score: 100,
      violations: 0,
      artifacts: ["artifacts/accessibility/devices-axe.json"],
      summary: "No violations detected",
    });

    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "accessibility",
        action: "axe-accessibility-audit",
        actor: "qa@example.com",
        status: "success",
      })
    );
  });

  it("records a fail result with error status and timestamp", async () => {
    const mockedRecord = recordAuditLog as MockedFunction<typeof recordAuditLog>;
    mockedRecord.mockResolvedValue();

    const timestamp = "2025-11-17T12:00:00.000Z";
    await recordAccessibilityAuditLog({
      tool: "lighthouse",
      target: "http://localhost:3000",
      result: "fail",
      tester: null,
      score: 82,
      violations: 3,
      artifacts: ["artifacts/accessibility/lighthouse-accessibility-report.json"],
      summary: "Low contrast on dashboard buttons",
      timestamp,
    });

    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        context: expect.objectContaining({
          timestamp,
          score: 82,
          violations: 3,
        }),
      })
    );
  });
});
