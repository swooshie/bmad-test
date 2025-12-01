import { describe, expect, it } from "vitest";

import { normalizeSheetRows } from "@/workers/sync/transform";

describe("normalizeSheetRows", () => {
  it("normalizes rows and produces deterministic hashes", () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const result = normalizeSheetRows(
      [
        {
          deviceId: "device-001 ",
          assignedTo: "alex@nyu.edu ",
          status: "ACTIVE",
          condition: "good",
          lastSeen: "2025-01-02T10:00:00Z",
        },
      ],
      { sheetId: "sheet-123", now, columnDefinitionsVersion: "registry-demo" }
    );

    expect(result.rowCount).toBe(1);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]).toMatchObject({
      serial: "device-001",
      legacyDeviceId: "device-001",
      assignedTo: "alex@nyu.edu",
      status: "Active",
      condition: "Good",
      sheetId: "sheet-123",
      lastSyncedAt: now,
      columnDefinitionsVersion: "registry-demo",
    });
    expect(result.devices[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records anomalies for missing serial", () => {
    const result = normalizeSheetRows(
      [
        {
          deviceId: "",
          assignedTo: "alex@nyu.edu",
          status: "Inactive",
          condition: "Poor",
        },
      ],
      { sheetId: "sheet-123" }
    );

    expect(result.devices).toHaveLength(0);
    expect(result.anomalies).toContain("row 1: missing serial – row skipped");
    expect(result.skipped).toBe(1);
  });

  it("parses last seen timestamps from multiple formats", () => {
    const now = new Date();
    const result = normalizeSheetRows(
      [
        {
          deviceId: "device-002",
          assignedTo: "Jamie",
          status: "Active",
          condition: "Good",
          lastSeen: 1731614400000,
        },
      ],
      { sheetId: "sheet-xyz", now }
    );

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].lastSeen).toBeInstanceOf(Date);
  });

  it("captures dynamic attributes for unknown headers", () => {
    const result = normalizeSheetRows(
      [
        {
          deviceId: "device-010",
          serial: "SER-10",
          assignedTo: "Jordan",
          status: "Active",
          condition: "Good",
          "Custom Column": "Sample",
        },
      ],
      {
        sheetId: "sheet-dyn",
        headers: [
          { name: "DeviceId", normalizedName: "deviceid", position: 0 },
          { name: "Serial", normalizedName: "serial", position: 1 },
          { name: "Custom Column", normalizedName: "custom_column", position: 2 },
        ],
      }
    );

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].dynamicAttributes).toEqual({ custom_column: "Sample" });
  });
});
