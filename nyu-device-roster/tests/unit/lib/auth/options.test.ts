import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  loadConfig: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestHeaders();
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

    const result = await signIn?.({ user: { email: undefined } } as any);

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

    const result = await signIn?.({ user: { email: "user@example.com" } } as any);

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

    const result = await signIn?.({ user: { email: "manager@nyu.edu" } } as any);

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

    const result = await signIn?.({ user: { email: "manager@nyu.edu" } } as any);

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

    const result = await signIn?.({ user: { email: "Manager@Nyu.edu" } } as any);

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
      session: { user: { email: "Original@Email" } } as any,
      token: { email: "Manager@NYU.edu" } as any,
    });

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
      user: { email: "Manager@NYU.edu" } as any,
    } as any);

    expect(token?.email).toBe("manager@nyu.edu");
  });
});
