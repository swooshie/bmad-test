import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  };
});

const mockSession = (email = "manager@nyu.edu") => ({
  user: { email },
});

describe("withSession middleware", () => {
beforeEach(() => {
  vi.clearAllMocks();
});

  it("returns 401 and logs a failure when the session is missing", async () => {
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
