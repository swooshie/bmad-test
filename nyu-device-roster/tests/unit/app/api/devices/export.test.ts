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

const buildDevice = (overrides: Partial<DeviceAttributes>): DeviceAttributes => ({
  deviceId: "device-001",
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
});

const buildRequest = (body?: Record<string, unknown>) => {
  const headers = new Map<string, string>();
  return {
    method: "POST",
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
      buildDevice({ deviceId: "alpha-1", offboardingStatus: "Pending Offboarding" }),
      buildDevice({ deviceId: "alpha-2", condition: "Needs Repair" }),
    ];
    vi.clearAllMocks();
    queryChain.sort.mockClear();
    queryChain.lean.mockClear();
    queryChain.exec.mockClear();
  });

  it("returns CSV with governance columns and logs audit events when flagged rows exist", async () => {
    const { POST } = await import("@/app/api/devices/export/route");

    const response = await POST(buildRequest() as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const csv = await response.text();
    expect(csv).toContain("Governance Severity");
    expect(csv).toContain("critical");
    expect(recordGovernanceExportEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        flaggedCount: 2,
        totalCount: 2,
      })
    );
  });

  it("returns PDF when requested", async () => {
    const { POST } = await import("@/app/api/devices/export/route");

    const response = await POST(
      buildRequest({
        format: "pdf",
      }) as never
    );

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("returns 404 when no rows match the filters", async () => {
    dataset = [];
    const { POST } = await import("@/app/api/devices/export/route");

    const response = await POST(
      buildRequest({
        onlyFlagged: true,
      }) as never
    );

    expect(response.status).toBe(404);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("NO_EXPORT_ROWS");
    expect(recordGovernanceExportEvent).not.toHaveBeenCalled();
  });
});
