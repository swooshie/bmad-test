import { beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile,
  default: { readFile },
}));

const connectToDatabase = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: connectToDatabase,
}));

const deviceDeleteMany = vi.fn();
const deviceInsertMany = vi.fn();

vi.mock("@/models/Device", () => ({
  __esModule: true,
  default: {
    deleteMany: deviceDeleteMany,
    insertMany: deviceInsertMany,
    find: vi.fn(),
  },
}));

const syncEventCreate = vi.fn();

vi.mock("@/models/SyncEvent", () => ({
  __esModule: true,
  default: {
    create: syncEventCreate,
  },
}));

const loggerInfo = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/logging", () => ({
  logger: {
    info: loggerInfo,
    error: loggerError,
  },
}));

const withTransaction = vi.fn(async (fn: () => Promise<void>) => {
  await fn();
});
const endSession = vi.fn();
const startSession = vi.fn(async () => ({
  withTransaction,
  endSession,
}));
const connectionClose = vi.fn().mockResolvedValue(undefined);

vi.mock("mongoose", async () => {
  const actual = (await vi.importActual<typeof import("mongoose")>("mongoose")) as typeof import("mongoose");
  const mockedDefault = (actual as typeof import("mongoose") & {
    default?: typeof import("mongoose");
  }).default ?? actual;
  mockedDefault.startSession = startSession;
  mockedDefault.connection = { close: connectionClose };
  return {
    ...actual,
    default: mockedDefault,
    startSession,
    connection: { close: connectionClose },
    models: actual.models ?? mockedDefault.models,
  };
});

describe("reset-sync script helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates baseline snapshot structure", async () => {
    const { readBaseline } = await import("../../../scripts/reset-sync");
    readFile.mockResolvedValueOnce('{"not":"array"}');

    await expect(readBaseline("test.json")).rejects.toThrow(
      /not an array/i
    );
  });

  it("runs rollback and writes audit event", async () => {
    const sample = JSON.stringify([
      {
        deviceId: "demo-device",
        sheetId: "demo-sheet",
        assignedTo: "Owner",
        status: "Assigned",
        condition: "Operational",
        lastSyncedAt: "2024-11-01T00:00:00.000Z",
        contentHash: "hash",
      },
    ]);
    readFile.mockResolvedValueOnce(sample);

    const { runRollback } = await import("../../../scripts/reset-sync");
    await runRollback("/tmp/devices.json");

    expect(connectToDatabase).toHaveBeenCalled();
    expect(startSession).toHaveBeenCalled();
    expect(deviceDeleteMany).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ session: expect.any(Object) })
    );
    expect(deviceInsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: "demo-device",
          sheetId: "demo-sheet",
        }),
      ]),
      expect.objectContaining({ session: expect.any(Object), ordered: false })
    );
    expect(syncEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          status: "rollback",
          restoredCount: 1,
        }),
      }),
      expect.objectContaining({ session: expect.any(Object) })
    );
  });
});
