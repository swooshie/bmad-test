import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  withSession:
    (handler: (request: unknown) => Promise<Response> | Response) =>
    (request: unknown) =>
      handler(request),
}));

const connectToDatabase = vi.fn();
vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: connectToDatabase,
}));

const recordGovernanceExportEvent = vi.fn();
vi.mock("@/lib/audit/syncEvents", () => ({
  recordGovernanceExportEvent,
}));

const loggerInfo = vi.fn();
vi.mock("@/lib/logging", () => ({
  __esModule: true,
  logger: {
    info: loggerInfo,
  },
}));

let dataset: DeviceAttributes[] = [];

const queryChain = {
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  exec: vi.fn(async () => dataset),
};

const findMock = vi.fn(() => queryChain);

vi.mock("@/models/Device", () => ({
  __esModule: true,
  default: {
    find: findMock,
  },
}));

import type { DeviceAttributes } from "@/models/Device";

const buildDevice = (overrides: Partial<DeviceAttributes>): DeviceAttributes => {
  const baseLegacyId = overrides.legacyDeviceId ?? "device-001";
  return {
    serial: overrides.serial ?? baseLegacyId.toLowerCase(),
    legacyDeviceId: baseLegacyId,
    sheetId: "sheet-a",
    assignedTo: "Alex",
    status: "Assigned",
    condition: "Operational",
    offboardingStatus: null,
  lastSeen: new Date("2025-01-10T12:00:00Z"),
  lastSyncedAt: new Date("2025-01-10T12:00:00Z"),
  contentHash: "hash",
  createdAt: new Date("2025-01-10T12:00:00Z"),
  updatedAt: new Date("2025-01-10T12:00:00Z"),
    ...overrides,
  };
};

const buildRequest = (body?: Record<string, unknown>, query = "") => {
  const headers = new Map<string, string>();
  return {
    method: "POST",
    nextUrl: new URL(`https://example.com/api/devices/export${query}`),
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    json: async () => body ?? {},
    session: {
      user: { email: "lead@nyu.edu" },
    },
  };
};

describe("POST /api/devices/export", () => {
  beforeEach(() => {
    dataset = [
      buildDevice({ legacyDeviceId: "alpha-1", offboardingStatus: "Pending Offboarding" }),
      buildDevice({ legacyDeviceId: "alpha-2", condition: "Needs Repair" }),
    ];
    vi.clearAllMocks();
    queryChain.sort.mockClear();
    queryChain.lean.mockClear();
    queryChain.exec.mockClear();
  });

  it("returns CSV with governance columns and logs audit events when flagged rows exist", async () => {
    const { POST } = await import("@/app/api/devices/export/route");

    const response = await POST(buildRequest(undefined, "?serial=alpha-1") as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const csv = await response.text();
    expect(csv).toContain("Governance Severity");
    expect(csv).toContain("attention");
    expect(recordGovernanceExportEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        flaggedCount: 1,
        totalCount: 1,
      })
    );
  });

  it("returns PDF when requested", async () => {
    const { POST } = await import("@/app/api/devices/export/route");

    const response = await POST(
      buildRequest(
        {
          format: "pdf",
        },
        "?serial=alpha-2"
      ) as never
    );

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("returns 404 when no rows match the filters", async () => {
    dataset = [];
    const { POST } = await import("@/app/api/devices/export/route");

    const response = await POST(
      buildRequest(
        {
          onlyFlagged: true,
        },
        "?serial=alpha-3"
      ) as never
    );

    expect(response.status).toBe(404);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("NO_EXPORT_ROWS");
    expect(recordGovernanceExportEvent).not.toHaveBeenCalled();
  });
});
