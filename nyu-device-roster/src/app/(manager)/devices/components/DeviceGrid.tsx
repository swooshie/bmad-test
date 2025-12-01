'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DeviceGridDevice, DeviceGridMeta } from "@/app/api/devices/device-query-service";
import type { DeviceColumn, DeviceColumnId } from "../types";
import type { DeviceGridQueryState } from "@/lib/devices/grid-query";
import type { DeviceFilterChip } from "../utils/filter-chips";

import { clampIndex, calculateVirtualWindow } from "../utils/virtual-window";
import { DeviceRow } from "./DeviceRow";

export type DeviceGridDensity = "comfortable" | "compact";

type DeviceGridProps = {
  rows: DeviceGridDevice[];
  columns: DeviceColumn[];
  meta: DeviceGridMeta | null;
  isLoading: boolean;
  error: string | null;
  state: DeviceGridQueryState;
  onRetry: () => void;
  onSort: (columnId: DeviceColumnId) => void;
  density: DeviceGridDensity;
  selectedSerial?: string | null;
  onSelectRow?: (row: DeviceGridDevice, element: HTMLDivElement | null) => void;
  highlightedIds?: Set<string>;
  onVirtualizationFallback?: (context: { rowsRendered: number; total?: number | null }) => void;
  filterChips?: DeviceFilterChip[];
  onResetFilters?: () => void;
  onConnectSheet?: () => void;
};

const sortLabel = (column: DeviceColumn, state: DeviceGridQueryState) => {
  if (state.sortBy !== column.id) {
    return "none";
  }
  return state.sortDirection === "asc" ? "ascending" : "descending";
};

export const DeviceGrid = ({
  rows,
  columns,
  meta,
  isLoading,
  error,
  state,
  onRetry,
  onSort,
  density,
  selectedSerial,
  onSelectRow,
  highlightedIds,
  onVirtualizationFallback,
  filterChips,
  onResetFilters,
  onConnectSheet,
}: DeviceGridProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const fallbackLoggedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    setViewportHeight(container.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setFocusedIndex(0);
    setScrollTop(0);
    if (typeof containerRef.current?.scrollTo === "function") {
      containerRef.current.scrollTo({ top: 0 });
    }
  }, [rows.length, density]);

  const totalRows = rows.length;
  const rowHeight = density === "compact" ? 44 : 56;
  const gridTemplateColumns = useMemo(
    () => columns.map((column) => `minmax(${column.minWidth ?? 140}px, max-content)`).join(" "),
    [columns]
  );
  const gridMinWidth = useMemo(
    () => columns.reduce((total, column) => total + (column.minWidth ?? 140), 0),
    [columns]
  );
  const virtualWindow = useMemo(
    () =>
      calculateVirtualWindow({
        total: totalRows,
        rowHeight,
        viewportHeight,
        scrollTop,
        overscan: 6,
      }),
    [rowHeight, scrollTop, totalRows, viewportHeight]
  );

  const visibleRows = rows.slice(virtualWindow.startIndex, virtualWindow.endIndex);
  const rowOffset = meta ? (meta.page - 1) * meta.pageSize : 0;

  useEffect(() => {
    const virtualizationDisabled = visibleRows.length === rows.length && rows.length > 80;
    if (virtualizationDisabled && !fallbackLoggedRef.current) {
      fallbackLoggedRef.current = true;
      onVirtualizationFallback?.({
        rowsRendered: rows.length,
        total: meta?.total ?? rows.length,
      });
    }
    if (!virtualizationDisabled) {
      fallbackLoggedRef.current = false;
    }
  }, [meta?.total, onVirtualizationFallback, rows.length, visibleRows.length]);

  const ensureVisible = useCallback((rowIndex: number) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const top = rowIndex * rowHeight;
    const bottom = top + rowHeight;
    if (top < container.scrollTop) {
      container.scrollTop = top;
    } else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom - container.clientHeight;
    }
  }, [rowHeight]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!totalRows) {
        return;
      }
      const container = containerRef.current;
      const viewportRows = Math.max(
        1,
        Math.floor((container ? container.clientHeight : rowHeight) / rowHeight)
      );
      let nextIndex = focusedIndex;
      if (event.key === "ArrowDown") {
        nextIndex = clampIndex(focusedIndex + 1, 0, totalRows - 1);
      } else if (event.key === "ArrowUp") {
        nextIndex = clampIndex(focusedIndex - 1, 0, totalRows - 1);
      } else if (event.key === "PageDown") {
        nextIndex = clampIndex(focusedIndex + viewportRows, 0, totalRows - 1);
      } else if (event.key === "PageUp") {
        nextIndex = clampIndex(focusedIndex - viewportRows, 0, totalRows - 1);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = totalRows - 1;
      } else {
        return;
      }
      event.preventDefault();
      setFocusedIndex(nextIndex);
      ensureVisible(nextIndex);
    },
    [ensureVisible, focusedIndex, totalRows]
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
        <span>Device Grid</span>
        <span>
          {meta
            ? meta.total === 0
              ? "No matching rows"
              : `Rows ${rowOffset + 1}-${rowOffset + rows.length} · Total ${meta.total}`
            : "Loading…"}
        </span>
      </div>
      <div
        ref={containerRef}
        role="grid"
        aria-rowcount={meta?.total ?? rows.length}
        aria-colcount={columns.length}
        aria-busy={isLoading}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="max-h-[560px] overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <div role="rowgroup">
          <div
          role="row"
          className="sticky top-0 z-10 grid border-b border-white/10 bg-slate-950/80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/80"
          style={{ gridTemplateColumns, minWidth: `${gridMinWidth}px` }}
        >
          {columns.map((column) => (
              <button
                key={column.id}
                type="button"
                onClick={() => onSort(column.id)}
                className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-sort={sortLabel(column, state)}
                aria-label={`Sort by ${column.label}`}
              >
                <span>{column.label}</span>
                {state.sortBy === column.id && (
                  <span aria-hidden="true">{state.sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div role="rowgroup" style={{ height: totalRows * rowHeight, position: "relative" }}>
          <div
            style={{
              transform: `translateY(${virtualWindow.offsetTop}px)`,
            }}
          >
            {visibleRows.map((row, index) => {
              const absoluteIndex = virtualWindow.startIndex + index;
              const isHighlighted = highlightedIds?.has(row.serial) ?? false;
              return (
                <DeviceRow
                  key={`${row.serial}-${absoluteIndex}`}
                  row={row}
                  columns={columns}
                  virtualIndex={absoluteIndex}
                  rowNumber={rowOffset + absoluteIndex + 1}
                  isFocused={focusedIndex === absoluteIndex}
                  onFocus={() => setFocusedIndex(absoluteIndex)}
                  isSelected={selectedSerial === row.serial}
                  onSelect={onSelectRow}
                  isHighlighted={isHighlighted}
                  rowHeight={rowHeight}
                  gridTemplateColumns={gridTemplateColumns}
                  gridMinWidth={gridMinWidth}
                />
              );
            })}
          </div>
        </div>
        {!rows.length && !isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-white/70" role="alert" aria-live="polite">
            {meta?.total === 0 && !(filterChips?.length ?? 0) ? (
              <div className="mx-auto max-w-xl space-y-3">
                <div className="text-4xl" aria-hidden="true">
                  🗂️
                </div>
                <p className="text-lg font-semibold text-white">Ready for first sync</p>
                <p className="text-sm text-white/80">
                  Connect the Google Sheet to hydrate the roster, then trigger a manual refresh to meet the 60-second freshness expectation.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <a
                    href="https://docs.google.com/spreadsheets/"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/30 px-4 py-2 font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
                  >
                    Connect Google Sheet
                  </a>
                  <button
                    type="button"
                    onClick={onConnectSheet}
                    className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Trigger manual refresh
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-xl space-y-3">
                <p className="text-lg font-semibold text-white">No matching results</p>
                <p className="text-sm text-white/80">
                  Active filters: {filterChips?.length ? filterChips.map((chip) => chip.label).join(", ") : "None"}.
                  Reset filters to broaden the grid.
                </p>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/60 hover:bg-white/10"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
      {error && (
        <div className="border-t border-white/10 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md border border-rose-300/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rose-100 hover:bg-rose-500/10"
          >
            Retry Load
          </button>
        </div>
      )}
      {isLoading && (
        <div className="border-t border-white/10 px-4 py-3 text-sm text-white/70">Loading devices…</div>
      )}
    </div>
  );
};

export default DeviceGrid;
