import { describe, expect, it, vi } from "vitest";

import { buildDynamicColumns, queryDeviceGrid } from "@/app/api/devices/device-query-service";
import { DEFAULT_DEVICE_GRID_STATE } from "@/lib/devices/grid-query";
import type { DeviceAttributes } from "@/models/Device";
import type { ColumnDefinitionAttributes } from "@/models/ColumnDefinition";

const dataset: DeviceAttributes[] = [
  {
    serial: "demo-001",
    legacyDeviceId: "demo-001",
    sheetId: "sheet-a",
    assignedTo: "Alex",
    status: "Assigned",
    condition: "Operational",
    offboardingStatus: "Requested",
    lastSeen: new Date("2025-01-10T12:00:00Z"),
    lastSyncedAt: new Date("2025-01-10T12:00:00Z"),
    contentHash: "1",
    createdAt: new Date("2025-01-10T12:00:00Z"),
    updatedAt: new Date("2025-01-10T12:00:00Z"),
  },
  {
    serial: "demo-002",
    legacyDeviceId: "demo-002",
    sheetId: "sheet-a",
    assignedTo: "Brooke",
    status: "Available",
    condition: "Needs Repair",
    offboardingStatus: null,
    lastSeen: new Date("2025-01-09T12:00:00Z"),
    lastSyncedAt: new Date("2025-01-09T12:00:00Z"),
    contentHash: "2",
    createdAt: new Date("2025-01-09T12:00:00Z"),
    updatedAt: new Date("2025-01-09T12:00:00Z"),
  },
  {
    serial: "demo-003",
    legacyDeviceId: "demo-003",
    sheetId: "sheet-b",
    assignedTo: "Casey",
    status: "Assigned",
    condition: "Operational",
    offboardingStatus: null,
    lastSeen: new Date("2025-01-08T12:00:00Z"),
    lastSyncedAt: new Date("2025-01-08T12:00:00Z"),
    contentHash: "3",
    createdAt: new Date("2025-01-08T12:00:00Z"),
    updatedAt: new Date("2025-01-08T12:00:00Z"),
  },
];

const cloneDataset = () => dataset.map((device) => ({ ...device }));

const applyFilter = (filter: Record<string, unknown>) => {
  const withoutOr = { ...filter };
  const orConditions = Array.isArray(filter.$or) ? (filter.$or as Record<string, unknown>[]) : [];
  delete withoutOr.$or;

  const matchesCondition = (doc: DeviceAttributes, condition: Record<string, unknown>) =>
    Object.entries(condition).every(([key, value]) => {
      const docValue = doc[key as keyof DeviceAttributes];
      if (value instanceof RegExp) {
        return value.test(String(docValue ?? ""));
      }
      if (value && typeof value === "object" && "$in" in (value as Record<string, unknown>)) {
        const set = (value as { $in: unknown[] }).$in;
        return set.includes(docValue);
      }
      return docValue === value;
    });

  return cloneDataset().filter((doc) => {
    const baseMatch = matchesCondition(doc, withoutOr);
    if (!orConditions.length) {
      return baseMatch;
    }
    return baseMatch && orConditions.some((condition) => matchesCondition(doc, condition));
  });
};

const createQueryChain = (initial: DeviceAttributes[], filter: Record<string, unknown>) => {
  let working = applyFilter(filter);
  return {
    sort(sortSpec: Record<string, 1 | -1>) {
      const [field, direction] = Object.entries(sortSpec)[0];
      working.sort((a, b) => {
        const aValue = a[field as keyof DeviceAttributes];
        const bValue = b[field as keyof DeviceAttributes];
        if (aValue === bValue) {
          return 0;
        }
        if (aValue! > bValue!) {
          return direction;
        }
        return -direction;
      });
      return this;
    },
    skip(count: number) {
      working = working.slice(count);
      return this;
    },
    limit(count: number) {
      working = working.slice(0, count);
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => working,
  };
};

vi.mock("@/lib/db", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/config", () => ({
  __esModule: true,
  ensureRuntimeConfig: vi.fn(() =>
    Promise.resolve({
      config: {
        devicesSheetId: "sheet-a",
      },
      secrets: {},
    })
  ),
}));

vi.mock("@/models/Device", () => {
  return {
    __esModule: true,
    default: {
      find: vi.fn((filter: Record<string, unknown>) => createQueryChain(dataset, filter)),
      countDocuments: vi.fn((filter: Record<string, unknown>) => ({
        exec: async () => applyFilter(filter).length,
      })),
      distinct: vi.fn((field: keyof DeviceAttributes) => ({
        exec: async () =>
          Array.from(new Set(dataset.map((doc) => doc[field]).filter((value) => Boolean(value)))),
      })),
    },
  };
});

vi.mock("@/models/ColumnDefinition", () => {
  return {
    __esModule: true,
    default: {
      find: vi.fn(() => ({
        sort: () => ({
          lean: async () => [] as ColumnDefinitionAttributes[],
        }),
      })),
    },
  };
});

describe("queryDeviceGrid (mocked)", () => {
  it("returns paginated rows sorted by timestamp", async () => {
    const result = await queryDeviceGrid({ ...DEFAULT_DEVICE_GRID_STATE, pageSize: 2 });

    expect(result.devices).toHaveLength(2);
    expect(result.devices[0].serial).toBe("demo-001");
    expect(result.meta.total).toBe(3);
    expect(result.meta.totalPages).toBe(2);
  });

  it("respects filters and search", async () => {
    const result = await queryDeviceGrid({
      ...DEFAULT_DEVICE_GRID_STATE,
      filters: { status: ["Assigned"], search: "003" },
    });

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].assignedTo).toBe("Casey");
    expect(result.meta.appliedFilters.status).toEqual(["Assigned"]);
  });
});

describe("buildDynamicColumns", () => {
  it("merges dynamic registry entries with base columns", () => {
    const now = new Date();
    const registry: ColumnDefinitionAttributes[] = [
      {
        sheetId: "sheet-a",
        columnKey: "serial",
        label: "Serial",
        displayOrder: 0,
        dataType: "string",
        nullable: false,
        detectedAt: now,
        lastSeenAt: now,
        removedAt: null,
        sourceVersion: "registry-test",
      },
      {
        sheetId: "sheet-a",
        columnKey: "battery_cycles",
        label: "Battery Cycles",
        displayOrder: 10,
        dataType: "number",
        nullable: true,
        detectedAt: now,
        lastSeenAt: now,
        removedAt: null,
        sourceVersion: "registry-test",
      },
    ];

    const { columns, version } = buildDynamicColumns(registry);
    const dynamic = columns.find((column) => column.id === "battery_cycles");
    expect(dynamic).toBeDefined();
    expect(dynamic?.source).toBe("dynamic");
    expect(dynamic?.governance?.anonymized).toBe(true);
    expect(dynamic?.order).toBeGreaterThan(8);
    expect(version).toBe("registry-test");
  });
});
