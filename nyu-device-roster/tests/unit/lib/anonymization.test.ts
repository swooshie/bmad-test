import { describe, expect, it } from "vitest";

import { anonymizeDeviceRow, __private__ } from "@/lib/anonymization";

describe("anonymization helpers", () => {
  it("builds deterministic placeholders from deviceId and field", () => {
    const first = __private__.buildPlaceholder("Device-123", "assignedTo");
    const second = __private__.buildPlaceholder("Device-123", "assignedTo");
    const differentField = __private__.buildPlaceholder("Device-123", "status");

    expect(first).toEqual(second);
    expect(first).not.toEqual(differentField);
  });

  it("masks sensitive fields when enabled", () => {
    const row = anonymizeDeviceRow(
      {
        deviceId: "Device-123",
        sheetId: "Sheet-1",
        assignedTo: "Alice",
        status: "Active",
        condition: "Good",
        offboardingStatus: null,
        lastSeen: null,
        lastSyncedAt: new Date().toISOString(),
        governanceCue: { severity: "clear", reasons: [], summary: "" },
        lastTransferNotes: "note",
      },
      true
    );

    expect(row.assignedTo.startsWith("Anon-")).toBe(true);
    expect(row.sheetId.startsWith("Anon-")).toBe(true);
    expect(row.lastTransferNotes?.startsWith("Anon-")).toBe(true);
  });
});
