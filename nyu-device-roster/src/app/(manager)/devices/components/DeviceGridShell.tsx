'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useDeviceGrid } from "../hooks/useDeviceGrid";
import { usePerformanceMetrics } from "../hooks/usePerformanceMetrics";
import { getColumnLabel, type DeviceColumnId } from "../types";
import GridControls from "./GridControls";
import DeviceGrid, { type DeviceGridDensity } from "./DeviceGrid";
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

const GRID_DENSITY_STORAGE_KEY = "nyu-device-grid-density";

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
  const { enabled: anonymized, isPending: anonymizePending, error: anonymizationError } = useAnonymizationState();
  const { startInteraction, recordInteraction } = usePerformanceMetrics({ anonymized });
  const pendingInteractionRef = useRef<(() => void) | null>(null);
  const wasLoadingRef = useRef(isLoading);
  const lastFocusedRowRef = useRef<HTMLElement | null>(null);
  const [clearedFilters, setClearedFilters] = useState<{ filters: typeof state.filters; chipOrder: string[] } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const anonymizationAlertRef = useRef<HTMLDivElement | null>(null);
  const [density, setDensity] = useState<DeviceGridDensity>(() => {
    if (typeof window === "undefined") {
      return "comfortable";
    }
    const stored = window.localStorage.getItem(GRID_DENSITY_STORAGE_KEY);
    return stored === "compact" ? "compact" : "comfortable";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(GRID_DENSITY_STORAGE_KEY, density);
  }, [density]);
  const focusAnonymizationControl = useCallback(() => {
    const toggle = document.querySelector('[aria-describedby="anonymization-help"]') as
      | HTMLElement
      | null;
    toggle?.focus();
  }, []);

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
        ["device-detail", row.serial],
        {
          serial: row.serial,
          legacyDeviceId: row.legacyDeviceId ?? null,
          assignedTo: row.assignedTo,
          condition: row.condition,
          offboardingStatus: row.offboardingStatus ?? null,
          governanceCue: row.governanceCue,
          lastTransferNotes: row.lastTransferNotes ?? null,
          offboardingMetadata: row.offboardingMetadata,
          updatedAt: row.lastSyncedAt ?? new Date().toISOString(),
        }
      );
      openDeviceDrawer(row.serial);
      updateLiveMessage(`Opened drawer for device ${row.serial}`);
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

  const handleClearFilters = useCallback(() => {
    setClearedFilters({ filters: state.filters, chipOrder: state.chipOrder });
    clearFilters();
    setShowUndo(true);
    updateLiveMessage("Cleared filters; undo available for 60 seconds");
    recordInteraction("grid-filter-clear", 0, 200, { anonymized });
  }, [anonymized, clearFilters, recordInteraction, state.chipOrder, state.filters, updateLiveMessage]);

  const handleUndoFilters = useCallback(() => {
    if (!clearedFilters) return;
    setFilters(clearedFilters.filters);
    reorderFilterChips(clearedFilters.chipOrder);
    setShowUndo(false);
    updateLiveMessage("Restored previous filters");
    recordInteraction("grid-filter-undo", 0, 200, { anonymized });
  }, [anonymized, clearedFilters, recordInteraction, reorderFilterChips, setFilters, updateLiveMessage]);

  useEffect(() => {
    if (anonymizationError) {
      anonymizationAlertRef.current?.focus({ preventScroll: true });
      recordInteraction("anonymization-error", 0, 200, { message: anonymizationError });
    }
  }, [anonymizationError, recordInteraction]);

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
        density={density}
        onDensityChange={(nextDensity) => {
          setDensity(nextDensity);
          updateLiveMessage(
            `Row density switched to ${nextDensity === "compact" ? "compact" : "comfortable"}`
          );
          recordInteraction("grid-density-change", 0, 150, { density: nextDensity });
        }}
        announce={updateLiveMessage}
      />
      <FilterChipsBar
        chips={activeFilterChips}
        onRemove={removeFilterChip}
        onReorder={reorderFilterChips}
        onClearAll={handleClearFilters}
        announce={updateLiveMessage}
      />
      {showUndo && clearedFilters ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-3 text-sm text-white"
          role="status"
          aria-live="polite"
        >
          <span>Filters cleared. Undo to restore previous scope.</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/60 hover:bg-white/5"
              onClick={handleUndoFilters}
            >
              Undo clear
            </button>
            <button
              type="button"
              className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:bg-white/5"
              onClick={() => setShowUndo(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
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
        density={density}
        selectedSerial={selection.selectedSerial}
        onSelectRow={handleSelectRow}
        highlightedIds={highlightedRows}
        onVirtualizationFallback={({ rowsRendered, total }) => {
          recordInteraction("grid-virtualization-fallback", rowsRendered, 200, {
            total: total ?? rowsRendered,
          });
          updateLiveMessage("Virtualization fallback detected; recorded performance metric");
        }}
        filterChips={activeFilterChips}
        onResetFilters={handleClearFilters}
        onConnectSheet={() => {
          recordInteraction("grid-empty-connect", 0, 200, { anonymized });
          refresh();
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

      {anonymizationError ? (
        <div
          ref={anonymizationAlertRef}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-rose-200/40 bg-rose-100/10 px-4 py-3 text-sm text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Data privacy toggle failed: {anonymizationError}</span>
            <button
              type="button"
              onClick={focusAnonymizationControl}
              className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40 hover:bg-white/5"
            >
              Return to controls
            </button>
          </div>
        </div>
      ) : null}

      <DeviceDrawer onClose={handleCloseDrawer} />
    </section>
  );
};

export default DeviceGridShell;
