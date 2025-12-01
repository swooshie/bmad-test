import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TypedRow } from "@/lib/google-sheets";

const bulkWrite = vi.fn();
const find = vi.fn();

vi.mock("@/models/Device", () => ({
  __esModule: true,
  default: {
    bulkWrite,
    find,
  },
}));

const syncEventCreate = vi.fn();

vi.mock("@/models/SyncEvent", () => ({
  __esModule: true,
  default: {
    create: syncEventCreate,
  },
}));

describe("serial migration helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds serial mapping while flagging missing serial rows", async () => {
    const { buildSerialMapping } = await import("../../../scripts/backfill-serial");
    const rows: TypedRow[] = [
      { deviceId: "Device-001", serial: "ABC123" },
      { deviceId: "Device-002", serial: null },
    ];

    const result = buildSerialMapping(rows);
    expect(result.mapping.size).toBe(1);
    expect(result.missingSerialRows).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it("runs dry-run migration without bulk writes", async () => {
    const { runSerialMigration } = await import("../../../scripts/backfill-serial");
    const rows: TypedRow[] = [
      { deviceId: "Device-001", serial: "SER-1" },
      { deviceId: "Device-002", serial: "SER-2" },
    ];

    const queryChain = {
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [
        {
          _id: "a",
          deviceId: "Device-001",
          serial: null,
        },
        {
          _id: "b",
          deviceId: "Device-002",
          serial: "ser-2",
        },
      ]),
    };
    find.mockReturnValue(queryChain);

    const report = await runSerialMigration({
      dryRun: true,
      batchSize: 10,
      sheetId: "sheet-1",
      tabName: "Devices",
      requestId: "req-1",
      sheetData: {
        headers: ["deviceId", "serial"],
        rows,
        rowMetadata: [],
        metrics: {
          durationMs: 1,
          rowCount: 2,
          pageCount: 1,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          sheetId: "sheet-1",
          tabName: "Devices",
        },
      },
      resumeToken: undefined,
    });

    expect(report.updated).toBe(1);
    expect(report.unchanged).toBe(1);
    expect(bulkWrite).not.toHaveBeenCalled();
    expect(syncEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MIGRATION_RUN",
        metadata: expect.objectContaining({ dryRun: true, updated: 1 }),
      })
    );
  });

  it("applies updates when dry-run disabled", async () => {
    const { runSerialMigration } = await import("../../../scripts/backfill-serial");
    const rows: TypedRow[] = [{ deviceId: "Device-010", serial: "SER-10" }];

    const queryChain = {
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [
        { _id: "x", deviceId: "Device-010", serial: null },
      ]),
    };
    find.mockReturnValue(queryChain);

    await runSerialMigration({
      dryRun: false,
      batchSize: 5,
      sheetId: "sheet-1",
      tabName: "Devices",
      requestId: "req-9",
      sheetData: {
        headers: ["deviceId", "serial"],
        rows,
        rowMetadata: [],
        metrics: {
          durationMs: 1,
          rowCount: 1,
          pageCount: 1,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          sheetId: "sheet-1",
          tabName: "Devices",
        },
      },
      resumeToken: undefined,
    });

    expect(bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { _id: "x" },
          }),
        }),
      ]),
      expect.objectContaining({ ordered: false })
    );
  });
});
