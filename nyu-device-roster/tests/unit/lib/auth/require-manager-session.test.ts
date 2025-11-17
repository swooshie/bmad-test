import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

const redirectMock = vi.fn(() => {
  throw new Error("REDIRECT");
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: headersMock,
}));

const logAuthFailure = vi.fn();
const logAuthSuccess = vi.fn();
vi.mock("@/lib/logging", () => ({
  logAuthFailure,
  logAuthSuccess,
}));

const recordAuthFailureEvent = vi.fn();
vi.mock("@/lib/audit/syncEvents", () => ({
  recordAuthFailureEvent,
}));

vi.mock("@/lib/auth/options", () => ({
  authOptions: {},
}));

describe("requireManagerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockReturnValue({
      get: (key: string) => {
        if (key === "x-forwarded-for") return "192.0.2.1";
        if (key === "x-request-id") return "req-123";
        return null;
      },
    });
  });

  it("returns session when user is present", async () => {
    const session = { user: { email: "manager@nyu.edu" } };
    mockGetServerSession.mockResolvedValue(session);
    const { requireManagerSession } = await import("@/lib/auth/require-manager-session");

    const result = await requireManagerSession({ route: "/dashboard" });

    expect(result).toEqual(session);
    expect(logAuthSuccess).toHaveBeenCalledWith({
      route: "/dashboard",
      method: "GET",
      userEmail: "manager@nyu.edu",
    });
    expect(recordAuthFailureEvent).not.toHaveBeenCalled();
  });

  it("logs and redirects when session is missing", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { requireManagerSession } = await import("@/lib/auth/require-manager-session");

    await expect(requireManagerSession({ route: "/dashboard" })).rejects.toThrow(
      "REDIRECT"
    );

    expect(recordAuthFailureEvent).toHaveBeenCalledWith({
      route: "/dashboard",
      method: "GET",
      reason: "SESSION_MISSING",
      requestId: "req-123",
      ip: "192.0.2.1",
      userEmail: null,
    });
    expect(logAuthFailure).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/access-denied");
  });
});
