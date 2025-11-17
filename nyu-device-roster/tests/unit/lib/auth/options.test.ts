import type { AuthOptions } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const googleProviderSpy = vi.fn().mockReturnValue({
  id: "google",
  name: "Google",
  type: "oauth",
});

vi.mock("next-auth/providers/google", () => ({
  __esModule: true,
  default: googleProviderSpy,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const mockLoadConfig = vi.fn();
const mockEnsureRuntimeConfig = vi
  .fn()
  .mockResolvedValue({
    config: {
      allowlist: [],
      devicesSheetId: "sheet-123",
      collectionName: "config",
      lastUpdatedAt: new Date(),
      updatedBy: "operator@example.com",
      changes: [],
    },
    secrets: {
      googleClientId: "secret-client-id",
      googleClientSecret: "secret-client-secret",
      nextAuthSecret: "nextauth-secret",
      mongoUri: "mongodb://example",
      sheetsServiceAccount: {
        type: "service_account",
        project_id: "demo",
        private_key_id: "key",
        private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
        client_email: "svc@example.com",
        client_id: "123",
        token_uri: "https://oauth2.googleapis.com/token",
      },
    },
  });

vi.mock("@/lib/config", () => ({
  loadConfig: mockLoadConfig,
  ensureRuntimeConfig: mockEnsureRuntimeConfig,
}));

vi.mock("@/lib/logging", () => {
  const warn = vi.fn();
  const debug = vi.fn();

  return {
    logger: { warn, error: vi.fn(), debug },
    logAllowlistRejection: warn,
    logAllowlistAdmit: debug,
    logAuthFailure: vi.fn(),
    logAuthAlert: vi.fn(),
    logAuthSuccess: vi.fn(),
  };
});

import { headers as mockedHeaders } from "next/headers";

type CallbackOptions = NonNullable<AuthOptions["callbacks"]>;
type SignInCallbackArgs = Parameters<NonNullable<CallbackOptions["signIn"]>>[0];
type SessionCallbackArgs = Parameters<NonNullable<CallbackOptions["session"]>>[0];
type JwtCallbackArgs = Parameters<NonNullable<CallbackOptions["jwt"]>>[0];

const mockRequestHeaders = (overrides: Record<string, string> = {}) => {
  const defaults = {
    "x-forwarded-for": "203.0.113.1",
    "x-request-id": "req-default",
  };
  const headerBag = new Headers();
  Object.entries({ ...defaults, ...overrides }).forEach(([key, value]) => {
    if (value) {
      headerBag.set(key, value);
    }
  });
  vi.mocked(mockedHeaders).mockReturnValue(headerBag);
};

describe("NextAuth allowlist enforcement", () => {
  beforeEach(async () => {
    vi.mocked(mockedHeaders).mockReset();
    mockRequestHeaders();
    mockLoadConfig.mockClear();
    mockEnsureRuntimeConfig.mockClear();

    const { logAllowlistRejection, logAllowlistAdmit } = await import("@/lib/logging");
    vi.mocked(logAllowlistRejection).mockClear();
    vi.mocked(logAllowlistAdmit).mockClear();
  });

  const buildConfig = (allowlist: string[]) => ({
    allowlist,
    devicesSheetId: "sheet-123",
    collectionName: "config",
    lastUpdatedAt: new Date(),
    updatedBy: "operator@example.com",
    changes: [],
  });

  it("rejects sign-in when email is missing", async () => {
    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistRejection } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: undefined } } as SignInCallbackArgs);

    expect(result).toBe(false);
    expect(logAllowlistRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "EMAIL_MISSING",
        timestamp: expect.any(String),
      })
    );
  });

  it("rejects non-nyu domains", async () => {
    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistRejection } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: "user@example.com" } } as SignInCallbackArgs);

    expect(result).toBe(false);
    expect(logAllowlistRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "DOMAIN_REJECTED",
        timestamp: expect.any(String),
      })
    );
  });

  it("rejects when config is unavailable", async () => {
    const { loadConfig } = await import("@/lib/config");
    vi.mocked(loadConfig).mockResolvedValueOnce(null);

    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistRejection } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: "manager@nyu.edu" } } as SignInCallbackArgs);

    expect(result).toBe(false);
    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(logAllowlistRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "CONFIG_MISSING",
        timestamp: expect.any(String),
      })
    );
  });

  it("rejects emails not present in allowlist and records operator metadata", async () => {
    const { loadConfig } = await import("@/lib/config");
    const config = buildConfig(["other@nyu.edu"]);
    config.updatedBy = "operator@nyu.edu";
    config.lastUpdatedAt = new Date("2025-01-01T00:00:00Z");
    vi.mocked(loadConfig).mockResolvedValueOnce(config);

    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistRejection } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: "manager@nyu.edu" } } as SignInCallbackArgs);

    expect(result).toBe(false);
    expect(logAllowlistRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "NOT_ALLOWLISTED",
        operatorId: "operator@nyu.edu",
        allowlistRevision: "2025-01-01T00:00:00.000Z",
      })
    );
  });

  it("admits allowlisted managers and logs the admission", async () => {
    const { loadConfig } = await import("@/lib/config");
    vi.mocked(loadConfig).mockResolvedValueOnce(buildConfig(["manager@nyu.edu"]));

    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistAdmit } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: "Manager@Nyu.edu" } } as SignInCallbackArgs);

    expect(result).toBe(true);
    expect(logAllowlistAdmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "manager@nyu.edu",
        timestamp: expect.any(String),
      })
    );
  });

  it("configures secure session cookies with one-hour TTL", async () => {
    const { authOptions } = await import("@/lib/auth/options");

    expect(authOptions.session?.strategy).toBe("jwt");
    expect(authOptions.session?.maxAge).toBe(60 * 60);
    expect(authOptions.session?.updateAge).toBe(10 * 60);
    expect(authOptions.jwt?.maxAge).toBe(60 * 60);

    const cookie = authOptions.cookies?.sessionToken;
    expect(cookie?.name).toBe("__Secure-next-auth.session-token");
    expect(cookie?.options?.httpOnly).toBe(true);
    expect(cookie?.options?.secure).toBe(true);
    expect(cookie?.options?.maxAge).toBe(60 * 60);
  });

  it("adds normalized manager identity to the session", async () => {
    const { authOptions } = await import("@/lib/auth/options");
    const sessionCallback = authOptions.callbacks?.session;

    const sessionResult = await sessionCallback?.({
      session: { user: { email: "Original@Email" } },
      token: { email: "Manager@NYU.edu" },
    } as SessionCallbackArgs);

    expect(sessionResult?.user?.email).toBe("manager@nyu.edu");
    expect((sessionResult?.user as Record<string, unknown>)?.role).toBe(
      "admissions-manager"
    );
  });

  it("persists normalized email in the JWT token", async () => {
    const { authOptions } = await import("@/lib/auth/options");
    const jwtCallback = authOptions.callbacks?.jwt;

    const token = await jwtCallback?.({
      token: {},
      user: { email: "Manager@NYU.edu" },
    } as JwtCallbackArgs);

    expect(token?.email).toBe("manager@nyu.edu");
  });
});

describe("secret-backed NextAuth bootstrap", () => {
  it("loads provider secrets from Secret Manager runtime config", async () => {
    const { authOptions } = await import("@/lib/auth/options");

    expect(googleProviderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "secret-client-id",
        clientSecret: "secret-client-secret",
      })
    );
    expect(authOptions.secret).toBe("nextauth-secret");
  });
});
