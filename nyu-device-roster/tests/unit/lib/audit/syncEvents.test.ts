import { describe, expect, it } from "vitest";

import { serializeSyncRunTelemetry } from "@/lib/audit/syncEvents";

describe("serializeSyncRunTelemetry", () => {
  it("fills defaults for optional fields", () => {
    const result = serializeSyncRunTelemetry({
      sheetId: "sheet-1",
      runId: "run-1",
      trigger: "manual",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:01:00.000Z",
      durationMs: 60_000,
      rowsProcessed: 5,
      status: "success",
    });

    expect(result).toMatchObject({
      requestedBy: null,
      anonymized: false,
      rowsSkipped: 0,
      conflicts: 0,
      rowCount: 5,
      serialConflicts: 0,
      queueLatencyMs: null,
      reason: null,
      anomalies: [],
      rowsAudited: 0,
      missingSerialCount: 0,
      skippedRows: [],
    });
  });

  it("preserves provided telemetry values", () => {
    const result = serializeSyncRunTelemetry({
      sheetId: "sheet-2",
      runId: "run-2",
      trigger: "system",
      requestedBy: "system",
      anonymized: true,
      startedAt: "2024-01-02T00:00:00.000Z",
      completedAt: "2024-01-02T00:05:00.000Z",
      durationMs: 300_000,
      rowsProcessed: 10,
      rowsSkipped: 2,
      conflicts: 3,
      rowCount: 12,
      status: "failed",
      queueLatencyMs: 1200,
      reason: "serial_audit_blocked",
      anomalies: ["duplicate"],
      added: 4,
      updated: 3,
      unchanged: 3,
      legacyIdsUpdated: 1,
      serialConflicts: 3,
      rowsAudited: 50,
      missingSerialCount: 1,
      skippedRows: [{ rowNumber: 2 }],
    });

    expect(result).toMatchObject({
      requestedBy: "system",
      anonymized: true,
      rowsSkipped: 2,
      conflicts: 3,
      rowCount: 12,
      status: "failed",
      queueLatencyMs: 1200,
      reason: "serial_audit_blocked",
      anomalies: ["duplicate"],
      added: 4,
      updated: 3,
      unchanged: 3,
      legacyIdsUpdated: 1,
      serialConflicts: 3,
      rowsAudited: 50,
      missingSerialCount: 1,
      skippedRows: [{ rowNumber: 2 }],
    });
  });
});
