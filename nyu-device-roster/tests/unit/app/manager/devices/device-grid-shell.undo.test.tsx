/**
 * @vitest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeviceGridShell from "@/app/(manager)/devices/components/DeviceGridShell";
import { DEFAULT_DEVICE_GRID_STATE } from "@/lib/devices/grid-query";

const clearFiltersSpy = vi.fn();
const setFiltersSpy = vi.fn();
const reorderFiltersSpy = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

vi.mock("@/app/(manager)/devices/hooks/useDeviceGrid", () => ({
  useDeviceGrid: () => ({
    rows: [],
    meta: {
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      appliedFilters: { status: ["Active"] },
      sort: { by: DEFAULT_DEVICE_GRID_STATE.sortBy, direction: DEFAULT_DEVICE_GRID_STATE.sortDirection },
      filterOptions: { statuses: [], conditions: [], offboardingStatuses: [] },
    },
    state: { ...DEFAULT_DEVICE_GRID_STATE, filters: { status: ["Active"] }, chipOrder: ["status:Active"] },
    columns: [],
    visibleColumns: [],
    isLoading: false,
    error: null,
    liveMessage: "ready",
    updateLiveMessage: vi.fn(),
    activeFilterChips: [
      { id: "status:Active", type: "status", value: "Active", label: "Status: Active", count: 0 },
    ],
    refresh: vi.fn(),
    setPage: vi.fn(),
    setSort: vi.fn(),
    setFilters: setFiltersSpy,
    setColumnVisibility: vi.fn(),
    resetColumns: vi.fn(),
    clearFilters: clearFiltersSpy,
    removeFilterChip: vi.fn(),
    reorderFilterChips: reorderFiltersSpy,
  }),
}));

vi.mock("@/app/(manager)/devices/state/device-selection-store", () => ({
  useDeviceSelection: () => ({ selectedDeviceId: null }),
  openDeviceDrawer: vi.fn(),
  closeDeviceDrawer: vi.fn(),
}));

vi.mock("@/app/(manager)/devices/hooks/usePerformanceMetrics", () => ({
  usePerformanceMetrics: () => ({
    startInteraction: () => () => undefined,
    recordInteraction: vi.fn(),
  }),
}));

vi.mock("@/app/(manager)/devices/hooks/useRowHighlighting", () => ({
  __esModule: true,
  default: () => new Set<string>(),
}));

vi.mock("@/app/(manager)/devices/state/anonymization-store", () => ({
  useAnonymizationState: () => ({ enabled: false, isPending: false, error: "Anonymization failed" }),
}));

vi.mock("@/app/(manager)/components/ExportControls", () => ({
  __esModule: true,
  default: () => <div data-testid="export-controls" />,
}));

vi.mock("@/app/(manager)/devices/components/GridControls", () => ({
  __esModule: true,
  default: () => <div data-testid="grid-controls" />,
}));

vi.mock("@/app/(manager)/devices/components/GovernanceFilterChips", () => ({
  __esModule: true,
  default: () => <div data-testid="governance-chips" />,
}));

vi.mock("@/app/(manager)/devices/components/AnonymizationToggle", () => ({
  __esModule: true,
  default: () => <div data-testid="anonymization-toggle" />,
}));

vi.mock("@/app/(manager)/components/IconActionRow", () => ({
  __esModule: true,
  default: () => <div data-testid="icon-action-row" />,
}));

vi.mock("@/app/(manager)/devices/components/FilterChipsBar", () => ({
  __esModule: true,
  default: ({ onClearAll }: { onClearAll: () => void }) => (
    <button type="button" onClick={onClearAll}>
      clear filters
    </button>
  ),
}));

vi.mock("@/app/(manager)/devices/components/DeviceGrid", () => ({
  __esModule: true,
  default: ({ onResetFilters }: { onResetFilters: () => void }) => (
    <button type="button" onClick={onResetFilters}>
      reset filters
    </button>
  ),
}));

vi.mock("@/app/(manager)/devices/components/DeviceDrawer", () => ({
  __esModule: true,
  DeviceDrawer: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close drawer
    </button>
  ),
  default: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close drawer
    </button>
  ),
}));

describe("DeviceGridShell undo chip and alerts", () => {
  it("surfaces undo chip after clearing filters and restores previous filters", async () => {
    render(<DeviceGridShell />);

    fireEvent.click(screen.getByText("clear filters"));
    expect(clearFiltersSpy).toHaveBeenCalledTimes(1);

    const undo = await screen.findByText("Undo clear");
    fireEvent.click(undo);

    expect(setFiltersSpy).toHaveBeenCalledTimes(1);
    expect(reorderFiltersSpy).toHaveBeenCalledTimes(1);
  });

  it("focuses anonymization alert when toggle errors", async () => {
    render(<DeviceGridShell />);

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });
});
