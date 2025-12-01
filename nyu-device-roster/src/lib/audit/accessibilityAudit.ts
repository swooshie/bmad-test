import { recordAuditLog, type AccessibilityAuditLog } from "@/lib/audit/auditLogs";

export const recordAccessibilityAuditLog = async (
  payload: AccessibilityAuditLog
): Promise<void> => {
  const timestamp = payload.timestamp ?? new Date().toISOString();

  await recordAuditLog({
    eventType: "accessibility",
    action: `${payload.tool}-accessibility-audit`,
    actor: payload.tester ?? null,
    status: payload.result === "pass" ? "success" : "error",
    context: {
      target: payload.target,
      result: payload.result,
      summary: payload.summary ?? null,
      score: payload.score ?? null,
      violations: payload.violations ?? null,
      artifacts: payload.artifacts ?? [],
      tool: payload.tool,
      tester: payload.tester ?? null,
      timestamp,
    },
  });
};

