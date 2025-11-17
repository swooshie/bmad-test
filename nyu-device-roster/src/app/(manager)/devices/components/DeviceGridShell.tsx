'use client';

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useDeviceGrid } from "../hooks/useDeviceGrid";
import { usePerformanceMetrics } from "../hooks/usePerformanceMetrics";
import { getColumnLabel, type DeviceColumnId } from "../types";
import GridControls from "./GridControls";
import DeviceGrid from "./DeviceGrid";
import type { DeviceGridMeta } from "@/app/api/devices/device-query-service";
import GovernanceFilterChips from "./GovernanceFilterChips";
import FilterChipsBar from "./FilterChipsBar";
import ExportControls from "@/app/(manager)/components/ExportControls";
import AnonymizationToggle from "./AnonymizationToggle";
import { anonymizeDeviceRow } from "@/lib/anonymization";
import { useAnonymizationState } from "../state/anonymization-store";
import { DeviceDrawer } from "./DeviceDrawer";
import { closeDeviceDrawer, openDeviceDrawer, useDeviceSelection } from "../state/device-selection-store";
import useRowHighlighting from "../hooks/useRowHighlighting";

const PaginationControls = ({
  meta,
  onPageChange,
  announce,
}: {
  meta: DeviceGridMeta | null;
  onPageChange: (page: number) => void;
  announce: (message: string) => void;
}) => {
  if (!meta) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-white/80">
      <div>
        Page {meta.page} of {meta.totalPages} · {meta.total} devices
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] hover:border-white/40 disabled:opacity-40"
          onClick={() => {
            onPageChange(meta.page - 1);
            announce(`Moved to page ${meta.page - 1}`);
          }}
          disabled={!meta.hasPreviousPage}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] hover:border-white/40 disabled:opacity-40"
          onClick={() => {
            onPageChange(meta.page + 1);
            announce(`Moved to page ${meta.page + 1}`);
          }}
          disabled={!meta.hasNextPage}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export const DeviceGridShell = () => {
  const {
    rows,
    meta,
    state,
    columns,
    visibleColumns,
    isLoading,
    error,
    liveMessage,
    updateLiveMessage,
    activeFilterChips,
    setFilters,
    clearFilters,
    removeFilterChip,
    reorderFilterChips,
    setColumnVisibility,
    resetColumns,
    setSort,
    refresh,
    setPage,
  } = useDeviceGrid();
  const selection = useDeviceSelection();
  const queryClient = useQueryClient();
  const { enabled: anonymized, isPending: anonymizePending } = useAnonymizationState();
  const { startInteraction, recordInteraction } = usePerformanceMetrics({ anonymized });
  const pendingInteractionRef = useRef<(() => void) | null>(null);
  const wasLoadingRef = useRef(isLoading);
  const lastFocusedRowRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && pendingInteractionRef.current) {
      pendingInteractionRef.current();
      pendingInteractionRef.current = null;
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const startGridInteraction = useCallback(
    (metricId: string, context?: Record<string, string | number | boolean>) => {
      pendingInteractionRef.current = startInteraction(metricId, 200, context);
    },
    [startInteraction]
  );

  const handleSort = useCallback(
    (columnId: DeviceColumnId) => {
      startGridInteraction("grid-sort", { columnId });
      const nextDirection =
        state.sortBy === columnId && state.sortDirection === "asc" ? "desc" : "asc";
      setSort(columnId);
      updateLiveMessage(
        `Sorted by ${getColumnLabel(columnId)} ${
          nextDirection === "asc" ? "ascending" : "descending"
        }`
      );
    },
    [setSort, startGridInteraction, state.sortBy, state.sortDirection, updateLiveMessage]
  );

  const displayedRows = useMemo(
    () => (anonymized ? rows.map((row) => anonymizeDeviceRow(row, true)) : rows),
    [anonymized, rows]
  );

  const handleSelectRow = useCallback(
    (row: typeof rows[number], element: HTMLDivElement | null) => {
      lastFocusedRowRef.current = element;
      queryClient.setQueryData(
        ["device-detail", row.deviceId],
        {
          deviceId: row.deviceId,
          assignedTo: row.assignedTo,
          condition: row.condition,
          offboardingStatus: row.offboardingStatus ?? null,
          governanceCue: row.governanceCue,
          lastTransferNotes: row.lastTransferNotes ?? null,
          offboardingMetadata: row.offboardingMetadata,
          updatedAt: row.lastSyncedAt ?? new Date().toISOString(),
        }
      );
      openDeviceDrawer(row.deviceId);
      updateLiveMessage(`Opened drawer for device ${row.deviceId}`);
    },
    [queryClient, updateLiveMessage]
  );

  const handleCloseDrawer = useCallback(() => {
    closeDeviceDrawer();
    updateLiveMessage("Closed device drawer");
    if (lastFocusedRowRef.current) {
      lastFocusedRowRef.current.focus();
    }
  }, [updateLiveMessage]);

  const highlightedRows = useRowHighlighting(rows, state.filters);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-4 text-sm text-indigo-100">
        Virtualized rows keep the interface under the 200&nbsp;ms response budget, while pagination
        ensures Mongo queries stay efficient even as the roster scales.
      </div>

      <GridControls
        meta={meta}
        state={state}
        columns={columns}
        onFilterChange={(filters) => {
          startGridInteraction("grid-filter");
          setFilters(filters);
        }}
        onColumnToggle={setColumnVisibility}
        onResetColumns={resetColumns}
        announce={updateLiveMessage}
      />
      <FilterChipsBar
        chips={activeFilterChips}
        onRemove={removeFilterChip}
        onReorder={reorderFilterChips}
        onClearAll={() => {
          clearFilters();
        }}
        announce={updateLiveMessage}
      />
      <GovernanceFilterChips
        meta={meta}
        state={state}
        onFilterChange={(filters) => {
          startGridInteraction("grid-filter");
          setFilters(filters);
        }}
        announce={updateLiveMessage}
      />
      <AnonymizationToggle announce={updateLiveMessage} />
      <ExportControls
        filters={state.filters}
        announce={(message) => {
          recordInteraction("grid-export", 0, 0, { action: "export" });
          updateLiveMessage(message);
        }}
      />

      <DeviceGrid
        rows={displayedRows}
        columns={visibleColumns}
        meta={meta}
        isLoading={isLoading || anonymizePending}
        error={error}
        state={state}
        onRetry={() => {
          startGridInteraction("grid-refresh");
          refresh();
        }}
        onSort={handleSort}
        selectedDeviceId={selection.selectedDeviceId}
        onSelectRow={handleSelectRow}
        highlightedIds={highlightedRows}
        onVirtualizationFallback={({ rowsRendered, total }) => {
          recordInteraction("grid-virtualization-fallback", rowsRendered, 200, {
            total: total ?? rowsRendered,
          });
          updateLiveMessage("Virtualization fallback detected; recorded performance metric");
        }}
      />

      <PaginationControls
        meta={meta}
        onPageChange={(page) => {
          startGridInteraction("grid-page");
          setPage(page);
        }}
        announce={updateLiveMessage}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <DeviceDrawer onClose={handleCloseDrawer} />
    </section>
  );
};

export default DeviceGridShell;
