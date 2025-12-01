/**
 * @vitest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeviceGrid from "@/app/(manager)/devices/components/DeviceGrid";
import { DEVICE_COLUMNS } from "@/app/(manager)/devices/types";
import type { DeviceGridMeta } from "@/app/api/devices/device-query-service";
import { DEFAULT_DEVICE_GRID_STATE } from "@/lib/devices/grid-query";

const baseMeta: DeviceGridMeta = {
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  appliedFilters: {},
  sort: { by: DEFAULT_DEVICE_GRID_STATE.sortBy, direction: DEFAULT_DEVICE_GRID_STATE.sortDirection },
  filterOptions: { statuses: [], conditions: [], offboardingStatuses: [] },
};

describe("DeviceGrid empty states", () => {
  it("renders first-use empty state with connect CTA", () => {
    const connectSpy = vi.fn();

    render(
      <DeviceGrid
        rows={[]}
        columns={DEVICE_COLUMNS.slice(0, 3)}
        meta={baseMeta}
        isLoading={false}
        error={null}
        state={DEFAULT_DEVICE_GRID_STATE}
        onRetry={vi.fn()}
        onSort={vi.fn()}
        filterChips={[]}
        onConnectSheet={connectSpy}
      />
    );

    expect(screen.getByText("Ready for first sync")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trigger manual refresh" }));
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("shows no-results message with active filters and reset action", () => {
    const resetSpy = vi.fn();

    render(
      <DeviceGrid
        rows={[]}
        columns={DEVICE_COLUMNS.slice(0, 3)}
        meta={{ ...baseMeta, appliedFilters: { status: ["Active"] } }}
        isLoading={false}
        error={null}
        state={{ ...DEFAULT_DEVICE_GRID_STATE, filters: { status: ["Active"] } }}
        onRetry={vi.fn()}
        onSort={vi.fn()}
        filterChips={[{ id: "status:Active", type: "status", value: "Active", label: "Status: Active", count: 0 }]}
        onResetFilters={resetSpy}
      />
    );

    expect(screen.getByText(/Active filters: Status: Active/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
