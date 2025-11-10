import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLoadConfig = vi.fn().mockResolvedValue({
  allowlist: ["manager@nyu.edu"],
  devicesSheetId: "sheet-123",
  collectionName: "config",
  lastUpdatedAt: new Date(),
  updatedBy: "operator@example.com",
  changes: [],
});

const mockEnsureRuntimeConfig = vi.fn().mockResolvedValue({
  config: {
    allowlist: ["manager@nyu.edu"],
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

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/logging", () => {
  const warn = vi.fn();
  const error = vi.fn();
  const debug = vi.fn();

  return {
    logger: { warn, error, debug },
    logAuthFailure: warn,
    logAuthAlert: error,
    logAuthSuccess: debug,
    logAllowlistRejection: warn,
    logAllowlistAdmit: debug,
    logConfigValidationFailure: error,
    logSecretManagerAlert: error,
  };
});

vi.mock("@/lib/audit/syncEvents", () => ({
  recordAuthFailureEvent: vi.fn().mockResolvedValue(undefined),
  recordConfigValidationEvent: vi.fn().mockResolvedValue(undefined),
}));

const mockSession = (email = "manager@nyu.edu") => ({
  user: { email },
});

describe("withSession middleware", () => {
beforeEach(() => {
  vi.clearAllMocks();
});

  it("returns 401, logs, and persists when the session is missing", async () => {
    const { getServerSession } = await import("next-auth/next");
    const mockedGetServerSession = vi.mocked(getServerSession);
    mockedGetServerSession.mockResolvedValueOnce(null);

    const { withSession, __resetFailureTrackerForTests } = await import(
      "@/lib/auth/sessionMiddleware"
    );
    __resetFailureTrackerForTests();
    const handler = vi.fn();
    const request = new NextRequest("http://localhost/api/secure", {
      method: "GET",
      headers: { "x-forwarded-for": "203.0.113.5", "x-request-id": "abc" },
    });

    const response = await withSession(handler)(request, {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();

    const { logAuthFailure } = await import("@/lib/logging");
    expect(logAuthFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "SESSION_MISSING",
        ip: "203.0.113.5",
        route: "/api/secure",
        method: "GET",
        requestId: "abc",
      })
    );

    const { recordAuthFailureEvent } = await import("@/lib/audit/syncEvents");
    expect(recordAuthFailureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "SESSION_MISSING",
        route: "/api/secure",
        method: "GET",
        ip: "203.0.113.5",
        requestId: "abc",
      })
    );
  });

  it("escalates to alert logging after repeated failures from the same IP", async () => {
    const { getServerSession } = await import("next-auth/next");
    const mockedGetServerSession = vi.mocked(getServerSession);
    mockedGetServerSession.mockResolvedValue(null);

    const { withSession, __resetFailureTrackerForTests } = await import(
      "@/lib/auth/sessionMiddleware"
    );
    __resetFailureTrackerForTests();
    const handler = vi.fn();
    const request = new NextRequest("http://localhost/api/secure", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.24" },
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await withSession(handler)(request, {});
      expect(response.status).toBe(401);
    }

    const { logAuthAlert } = await import("@/lib/logging");
    expect(logAuthAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: "198.51.100.24",
        count: expect.any(Number),
      })
    );
  });

  it("passes the session to the route handler when validation succeeds", async () => {
    const { getServerSession } = await import("next-auth/next");
    const mockedGetServerSession = vi.mocked(getServerSession);
    mockedGetServerSession.mockResolvedValue(mockSession());

    const { withSession, __resetFailureTrackerForTests } = await import(
      "@/lib/auth/sessionMiddleware"
    );
    __resetFailureTrackerForTests();
    const handler = vi.fn(async () =>
      NextResponse.json({ status: "ok" }, { status: 200 })
    );
    const request = new NextRequest("http://localhost/api/secure", {
      method: "GET",
      headers: { "x-forwarded-for": "192.0.2.10" },
    });

    const response = await withSession(handler)(request, { params: {} });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const [passedRequest] = handler.mock.calls[0];
    expect(passedRequest.session.user.email).toBe("manager@nyu.edu");

    const { logAuthSuccess } = await import("@/lib/logging");
    expect(logAuthSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "manager@nyu.edu",
        route: "/api/secure",
        method: "GET",
      })
    );
  });
});
