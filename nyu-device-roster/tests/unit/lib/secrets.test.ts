import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accessSecretVersion = vi.fn();
const loggingSpies = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
const loggerWarn = loggingSpies.warn;
vi.mock("@/lib/logging", () => ({
  logger: loggingSpies,
}));

vi.mock("@google-cloud/secret-manager", () => {
  class MockSecretManagerServiceClient {
    accessSecretVersion = accessSecretVersion;
  }

  return {
    SecretManagerServiceClient: MockSecretManagerServiceClient,
  };
});

import {
  __resetSecretManagerClientForTests,
  getGoogleClientId,
  getMongoConnectionUri,
  loadAllSecrets,
  SecretProviderError,
} from "@/lib/secrets";
import path from "path";

describe("Secret Manager helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessSecretVersion.mockReset();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.SECRET_NAME_GOOGLE_CLIENT_ID;
    delete process.env.SECRET_NAME_GOOGLE_CLIENT_SECRET;
    delete process.env.SECRET_NAME_NEXTAUTH_SECRET;
    delete process.env.SECRET_NAME_SHEETS_SERVICE_ACCOUNT;
    delete process.env.SECRET_NAME_MONGODB_URI;
    delete process.env.SECRET_NAME_SYNC_SCHEDULER_TOKEN;
    delete process.env.MONGODB_URI;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.SYNC_SCHEDULER_TOKEN;
    delete process.env.SHEETS_SERVICE_ACCOUNT_JSON;
    delete process.env.SHEETS_SERVICE_ACCOUNT_SAMPLE_PATH;
  });

  afterEach(() => {
    __resetSecretManagerClientForTests();
  });

  it("fetches and caches Google client ID from Secret Manager", async () => {
    process.env.SECRET_NAME_GOOGLE_CLIENT_ID = "projects/demo/secrets/google-client-id";
    accessSecretVersion.mockResolvedValue([
      {
        name: "projects/demo/secrets/google-client-id/versions/3",
        payload: { data: Buffer.from("client-id-value") },
      },
    ]);

    const first = await getGoogleClientId();
    const second = await getGoogleClientId();

    expect(first).toBe("client-id-value");
    expect(second).toBe("client-id-value");
    expect(accessSecretVersion).toHaveBeenCalledTimes(1);
  });

  it("forces refresh when requested to capture rotation", async () => {
    process.env.SECRET_NAME_GOOGLE_CLIENT_ID = "projects/demo/secrets/google-client-id";
    accessSecretVersion
      .mockResolvedValueOnce([
        {
          name: "projects/demo/secrets/google-client-id/versions/3",
          payload: { data: Buffer.from("client-id-value") },
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "projects/demo/secrets/google-client-id/versions/4",
          payload: { data: Buffer.from("new-client-id-value") },
        },
      ]);

    const first = await getGoogleClientId();
    expect(first).toBe("client-id-value");

    const rotated = await getGoogleClientId({ forceRefresh: true });
    expect(rotated).toBe("new-client-id-value");
    expect(accessSecretVersion).toHaveBeenCalledTimes(2);
  });

  it("retries Secret Manager access before surfacing error", async () => {
    process.env.SECRET_NAME_MONGODB_URI = "projects/demo/secrets/mongodb-uri";
    const failure = new Error("permission denied");
    accessSecretVersion
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce([
        {
          name: "projects/demo/secrets/mongodb-uri/versions/7",
          payload: { data: Buffer.from("mongodb://example") },
        },
      ]);

    const uri = await getMongoConnectionUri();
    expect(uri).toBe("mongodb://example");
    expect(accessSecretVersion).toHaveBeenCalledTimes(2);
  });

  it("falls back to environment variable when Secret Manager path is missing", async () => {
    process.env.GOOGLE_CLIENT_ID = "local-client-id";

    const value = await getGoogleClientId();

    expect(value).toBe("local-client-id");
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });

  it("throws SecretProviderError when Secret Manager keeps failing", async () => {
    process.env.SECRET_NAME_MONGODB_URI = "projects/demo/secrets/mongodb-uri";
    accessSecretVersion.mockRejectedValue(new Error("boom"));

    await expect(getMongoConnectionUri()).rejects.toBeInstanceOf(SecretProviderError);
  });

  it("loads all secrets in parallel for runtime config assembly", async () => {
    process.env.SECRET_NAME_GOOGLE_CLIENT_ID = "projects/demo/secrets/google-client-id";
    process.env.SECRET_NAME_GOOGLE_CLIENT_SECRET = "projects/demo/secrets/google-client-secret";
    process.env.SECRET_NAME_NEXTAUTH_SECRET = "projects/demo/secrets/nextauth-secret";
    process.env.SECRET_NAME_MONGODB_URI = "projects/demo/secrets/mongodb-uri";
    process.env.SECRET_NAME_SHEETS_SERVICE_ACCOUNT =
      "projects/demo/secrets/sheets-service-account";
    process.env.SECRET_NAME_SYNC_SCHEDULER_TOKEN =
      "projects/demo/secrets/sync-scheduler-token";

    accessSecretVersion
      .mockResolvedValueOnce([
        { name: "version", payload: { data: Buffer.from("client-id") } },
      ])
      .mockResolvedValueOnce([
        { name: "version", payload: { data: Buffer.from("client-secret") } },
      ])
      .mockResolvedValueOnce([
        { name: "version", payload: { data: Buffer.from("nextauth-secret") } },
      ])
      .mockResolvedValueOnce([
        { name: "version", payload: { data: Buffer.from("mongodb://example") } },
      ])
      .mockResolvedValueOnce([
        {
          name: "version",
          payload: {
            data: Buffer.from(
              JSON.stringify({
                type: "service_account",
                project_id: "demo",
                private_key_id: "key",
                private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
                client_email: "svc@example",
                client_id: "123",
                token_uri: "https://oauth2.googleapis.com/token",
              })
            ),
          },
        },
      ])
      .mockResolvedValueOnce([
        { name: "version", payload: { data: Buffer.from("scheduler-token") } },
      ]);

    const secrets = await loadAllSecrets();

    expect(secrets.googleClientId).toBe("client-id");
    expect(secrets.sheetsServiceAccount.project_id).toBe("demo");
    expect(secrets.syncSchedulerToken).toBe("scheduler-token");
    expect(accessSecretVersion).toHaveBeenCalledTimes(6);
  });

  it("falls back to sample sheets service account file for local development", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.NEXTAUTH_SECRET = "nextauth-secret";
    process.env.MONGODB_URI = "mongodb://example";
    process.env.SYNC_SCHEDULER_TOKEN = "local-scheduler-token";
    delete process.env.SHEETS_SERVICE_ACCOUNT_JSON;
    delete process.env.SECRET_NAME_SHEETS_SERVICE_ACCOUNT;
    delete process.env.SECRET_NAME_SYNC_SCHEDULER_TOKEN;

    process.env.SHEETS_SERVICE_ACCOUNT_SAMPLE_PATH = path.resolve(
      process.cwd(),
      "config/local-dev/sheets-service-account.sample.json"
    );

    const secrets = await loadAllSecrets();

    expect(secrets.sheetsServiceAccount.project_id).toBe("local-dev-project");
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SHEETS_SERVICE_ACCOUNT_SAMPLE_USED",
      }),
      expect.stringContaining("sample sheets service account")
    );
  });
});
