'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DeviceGridDevice, DeviceGridMeta } from "@/app/api/devices/device-query-service";
import type { DeviceColumn, DeviceColumnId } from "../types";
import type { DeviceGridQueryState } from "@/lib/devices/grid-query";

import { clampIndex, calculateVirtualWindow } from "../utils/virtual-window";
import { DeviceRow } from "./DeviceRow";

const ROW_HEIGHT = 56;

type DeviceGridProps = {
  rows: DeviceGridDevice[];
  columns: DeviceColumn[];
  meta: DeviceGridMeta | null;
  isLoading: boolean;
  error: string | null;
  state: DeviceGridQueryState;
  onRetry: () => void;
  onSort: (columnId: DeviceColumnId) => void;
  selectedDeviceId?: string | null;
  onSelectRow?: (row: DeviceGridDevice, element: HTMLDivElement | null) => void;
  highlightedIds?: Set<string>;
  onVirtualizationFallback?: (context: { rowsRendered: number; total?: number | null }) => void;
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
  selectedDeviceId,
  onSelectRow,
  highlightedIds,
  onVirtualizationFallback,
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
    containerRef.current?.scrollTo({ top: 0 });
  }, [rows]);

  const totalRows = rows.length;
  const virtualWindow = useMemo(
    () =>
      calculateVirtualWindow({
        total: totalRows,
        rowHeight: ROW_HEIGHT,
        viewportHeight,
        scrollTop,
        overscan: 6,
      }),
    [scrollTop, totalRows, viewportHeight]
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
    const top = rowIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < container.scrollTop) {
      container.scrollTop = top;
    } else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom - container.clientHeight;
    }
  }, []);

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
        Math.floor((container ? container.clientHeight : ROW_HEIGHT) / ROW_HEIGHT)
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

  const gridTemplateColumns = columns
    .map((column) => `minmax(${column.minWidth ?? 140}px, 1fr)`)
    .join(" ");

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
            style={{ gridTemplateColumns }}
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
        <div role="rowgroup" style={{ height: totalRows * ROW_HEIGHT, position: "relative" }}>
          <div
            style={{
              transform: `translateY(${virtualWindow.offsetTop}px)`,
            }}
          >
            {visibleRows.map((row, index) => {
              const absoluteIndex = virtualWindow.startIndex + index;
              const isHighlighted = highlightedIds?.has(row.deviceId) ?? false;
              return (
                <DeviceRow
                  key={`${row.deviceId}-${absoluteIndex}`}
                  row={row}
                  columns={columns}
                  virtualIndex={absoluteIndex}
                  rowNumber={rowOffset + absoluteIndex + 1}
                  isFocused={focusedIndex === absoluteIndex}
                  onFocus={() => setFocusedIndex(absoluteIndex)}
                  isSelected={selectedDeviceId === row.deviceId}
                  onSelect={onSelectRow}
                  isHighlighted={isHighlighted}
                />
              );
            })}
          </div>
        </div>
        {!rows.length && !isLoading && (
          <div className="px-6 py-10 text-center text-sm text-white/70">
            No devices match the current filters. Adjust filters or clear them to see more results.
          </div>
        )}
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
