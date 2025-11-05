import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("NextAuth allowlist enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect.objectContaining({ reason: "EMAIL_MISSING" })
    );
  });

  it("rejects non-nyu domains", async () => {
    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistRejection } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: "user@example.com" } } as any);

    expect(result).toBe(false);
    expect(logAllowlistRejection).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "DOMAIN_REJECTED" })
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
      expect.objectContaining({ reason: "CONFIG_MISSING" })
    );
  });

  it("rejects emails not present in allowlist", async () => {
    const { loadConfig } = await import("@/lib/config");
    vi.mocked(loadConfig).mockResolvedValueOnce(buildConfig(["other@nyu.edu"]));

    const { authOptions } = await import("@/lib/auth/options");
    const signIn = authOptions.callbacks?.signIn;
    const { logAllowlistRejection } = await import("@/lib/logging");

    const result = await signIn?.({ user: { email: "manager@nyu.edu" } } as any);

    expect(result).toBe(false);
    expect(logAllowlistRejection).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "NOT_ALLOWLISTED" })
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
      expect.objectContaining({ email: "manager@nyu.edu" })
    );
  });
});
