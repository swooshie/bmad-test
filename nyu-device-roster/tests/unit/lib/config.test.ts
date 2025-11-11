import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue(undefined),
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  resetDatabaseConnectionForTests: vi.fn(),
}));

const mockLoadAllSecrets = vi.fn().mockResolvedValue({
  googleClientId: "client-id",
  googleClientSecret: "client-secret",
  nextAuthSecret: "nextauth-secret",
  mongoUri: "mongodb://example",
  syncSchedulerToken: "scheduler-token",
  sheetsServiceAccount: {
    type: "service_account",
    project_id: "demo",
    private_key_id: "key",
    private_key: "-----BEGIN PRIVATE KEY-----\ndemo\n-----END PRIVATE KEY-----\n",
    client_email: "svc@example.com",
    client_id: "123",
    token_uri: "https://oauth2.googleapis.com/token",
  },
});

const mockRecordConfigValidationEvent = vi.fn().mockResolvedValue(undefined);

class MockSecretProviderError extends Error {
  constructor(public secretKey: string, message: string) {
    super(message);
    this.name = "SecretProviderError";
  }
}

vi.mock("@/lib/secrets", () => ({
  loadAllSecrets: mockLoadAllSecrets,
  SecretProviderError: MockSecretProviderError,
}));

vi.mock("@/lib/logging", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logConfigValidationFailure: vi.fn(),
  logSecretManagerAlert: vi.fn(),
}));

vi.mock("@/lib/audit/syncEvents", () => ({
  recordConfigValidationEvent: mockRecordConfigValidationEvent,
}));

const buildDocument = (allowlist: string[]) => ({
  allowlist,
  devicesSheetId: "sheet-123",
  collectionName: "config",
  lastUpdatedAt: new Date("2024-01-01T00:00:00Z"),
  updatedBy: "operator",
  changes: [],
  sync: {
    enabled: true,
    intervalMinutes: 2,
    timezone: "Etc/UTC",
  },
});

describe("config helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAllSecrets.mockClear();
    mockRecordConfigValidationEvent.mockClear();
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

    expect(result.config.allowlist).toEqual(["existing@nyu.edu", "manager@nyu.edu"]);
    expect(result.config.changes[0]?.emailsAdded).toEqual(["manager@nyu.edu"]);
    expect(result.config.changes[0]?.source).toBe("cli");
    expect(result.diff).toEqual({
      added: ["manager@nyu.edu"],
      removed: [],
      unchanged: ["existing@nyu.edu"],
    });

    findOneSpy.mockRestore();
    findOneAndUpdateSpy.mockRestore();
  });

  it("builds runtime config by merging Mongo config with Secret Manager payload", async () => {
    const { default: ConfigModel } = await import("@/models/Config");
    const findOneSpy = vi
      .spyOn(ConfigModel, "findOne")
      .mockReturnValue({ lean: vi.fn().mockResolvedValue(buildDocument(["manager@nyu.edu"])) } as never);

    const { loadRuntimeConfig, resetRuntimeConfigCache } = await import("@/lib/config");
    resetRuntimeConfigCache();

    const runtime = await loadRuntimeConfig();

    expect(runtime.config.allowlist).toEqual(["manager@nyu.edu"]);
    expect(runtime.secrets.googleClientId).toBe("client-id");
    expect(mockLoadAllSecrets).toHaveBeenCalledTimes(1);
    findOneSpy.mockRestore();
  });

  it("caches runtime config and secrets within TTL", async () => {
    vi.useFakeTimers();
    const { default: ConfigModel } = await import("@/models/Config");
    const findOneSpy = vi
      .spyOn(ConfigModel, "findOne")
      .mockReturnValue({ lean: vi.fn().mockResolvedValue(buildDocument(["manager@nyu.edu"])) } as never);

    const { loadRuntimeConfig, resetRuntimeConfigCache } = await import("@/lib/config");
    resetRuntimeConfigCache();

    const first = await loadRuntimeConfig();
    expect(first.config.allowlist).toEqual(["manager@nyu.edu"]);
    expect(mockLoadAllSecrets).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);

    const second = await loadRuntimeConfig();
    expect(second).toBe(first);
    expect(mockLoadAllSecrets).toHaveBeenCalledTimes(1);

    findOneSpy.mockRestore();
    vi.useRealTimers();
  });

  it("records validation failure when runtime config is missing", async () => {
    const { default: ConfigModel } = await import("@/models/Config");
    const findOneSpy = vi
      .spyOn(ConfigModel, "findOne")
      .mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);

    const { ensureRuntimeConfig, resetRuntimeConfigCache, resetConfigCache } = await import(
      "@/lib/config"
    );
    resetRuntimeConfigCache();
    resetConfigCache();

    await expect(ensureRuntimeConfig()).rejects.toThrow("Configuration document is missing");
    expect(mockRecordConfigValidationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining("Configuration document is missing"),
      })
    );

    findOneSpy.mockRestore();
  });
});
