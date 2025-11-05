import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue(undefined),
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  resetDatabaseConnectionForTests: vi.fn(),
}));

const buildDocument = (allowlist: string[]) => ({
  allowlist,
  devicesSheetId: "sheet-123",
  collectionName: "config",
  lastUpdatedAt: new Date("2024-01-01T00:00:00Z"),
  updatedBy: "operator",
  changes: [],
});

describe("config helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("memoizes config lookups within the cache window", async () => {
    vi.useFakeTimers();

    const { default: ConfigModel } = await import("@/models/Config");
    const firstMock = vi.fn().mockResolvedValue(buildDocument(["manager@nyu.edu"]));
    const findOneSpy = vi
      .spyOn(ConfigModel, "findOne")
      .mockReturnValue({ lean: firstMock } as never);

    const { loadConfig } = await import("@/lib/config");

    const first = await loadConfig();
    expect(first?.allowlist).toEqual(["manager@nyu.edu"]);
    expect(findOneSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);

    const second = await loadConfig();
    expect(second).toEqual(first);
    expect(findOneSpy).toHaveBeenCalledTimes(1);

    findOneSpy.mockRestore();
  });

  it("normalizes and records allowlist changes when upserting", async () => {
    const { default: ConfigModel } = await import("@/models/Config");
    const existing = buildDocument(["existing@nyu.edu"]);
    const created = buildDocument(["existing@nyu.edu", "manager@nyu.edu"]);

    const findOneSpy = vi
      .spyOn(ConfigModel, "findOne")
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(existing) } as never)
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(existing) } as never);

    const leanResult = vi.fn().mockResolvedValue({
      ...created,
      changes: [
        {
          operatorId: "cli-operator",
          timestamp: new Date("2024-01-02T00:00:00Z"),
          emailsAdded: ["manager@nyu.edu"],
          emailsRemoved: [],
          source: "cli" as const,
        },
      ],
    });

    const findOneAndUpdateSpy = vi
      .spyOn(ConfigModel, "findOneAndUpdate")
      .mockReturnValue({ lean: leanResult } as never);

    const { upsertConfig } = await import("@/lib/config");

    const result = await upsertConfig({
      allowlist: ["Manager@Nyu.edu", "existing@nyu.edu"],
      devicesSheetId: "sheet-123",
      collectionName: "config",
      operatorId: "cli-operator",
      source: "cli",
    });

    expect(findOneSpy).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        $set: expect.objectContaining({
          allowlist: ["existing@nyu.edu", "manager@nyu.edu"],
          updatedBy: "cli-operator",
        }),
      }),
      expect.objectContaining({ upsert: true })
    );

    expect(result.allowlist).toEqual(["existing@nyu.edu", "manager@nyu.edu"]);
    expect(result.changes[0]?.emailsAdded).toEqual(["manager@nyu.edu"]);
    expect(result.changes[0]?.source).toBe("cli");

    findOneSpy.mockRestore();
    findOneAndUpdateSpy.mockRestore();
  });
});
