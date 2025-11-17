import React from "react";
import { describe, expect, it, vi } from "vitest";
import ReactDOMServer from "react-dom/server";

import DeviceGrid from "@/app/(manager)/devices/components/DeviceGrid";
import { DEVICE_COLUMNS } from "@/app/(manager)/devices/types";
import type { DeviceGridDevice, DeviceGridMeta } from "@/app/api/devices/device-query-service";
import { DEFAULT_DEVICE_GRID_STATE } from "@/lib/devices/grid-query";

const rows: DeviceGridDevice[] = [
  {
    deviceId: "demo-001",
    sheetId: "demo",
    assignedTo: "Alex",
    status: "Assigned",
    condition: "Operational",
    offboardingStatus: "Requested",
    lastSeen: new Date("2025-01-10T12:00:00Z").toISOString(),
    lastSyncedAt: new Date("2025-01-10T12:00:00Z").toISOString(),
    governanceCue: {
      severity: "attention",
      reasons: ["offboarding"],
      summary: "Offboarding: Requested",
      flags: {
        offboardingStatus: "Requested",
        condition: "Operational",
      },
    },
    lastTransferNotes: null,
    offboardingMetadata: undefined,
  },
];

const meta: DeviceGridMeta = {
  page: 1,
  pageSize: 50,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  appliedFilters: {},
  sort: { by: "lastSyncedAt", direction: "desc" },
  filterOptions: { statuses: [], conditions: [], offboardingStatuses: [] },
};

describe("DeviceGrid accessibility", () => {
  it("renders role attributes and row indices", () => {
    const markup = ReactDOMServer.renderToStaticMarkup(
      <DeviceGrid
        rows={rows}
        columns={DEVICE_COLUMNS.slice(0, 3)}
        meta={meta}
        isLoading={false}
        error={null}
        state={{ ...DEFAULT_DEVICE_GRID_STATE, sortBy: "deviceId", sortDirection: "desc" }}
        onRetry={vi.fn()}
        onSort={vi.fn()}
      />
    );

    expect(markup).toContain('role="grid"');
    expect(markup).toContain('aria-rowindex="1"');
    expect(markup).toContain('aria-sort="descending"');
  });
});
