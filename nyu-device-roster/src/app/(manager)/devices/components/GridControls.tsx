'use client';

import { useMemo, useState } from "react";

import type { DeviceGridMeta } from "@/app/api/devices/device-query-service";
import type {
  DeviceGridQueryFilters,
  DeviceGridQueryState,
} from "@/lib/devices/grid-query";
import type { DeviceColumn, DeviceColumnId } from "../types";
import type { DeviceGridDensity } from "./DeviceGrid";
import { countActiveFilters, toggleListValue } from "../utils/filter-helpers";

type GridControlsProps = {
  meta: DeviceGridMeta | null;
  state: DeviceGridQueryState;
  columns: DeviceColumn[];
  onFilterChange: (filters: Partial<DeviceGridQueryFilters>) => void;
  onColumnToggle: (columnId: DeviceColumnId, visible: boolean) => void;
  onResetColumns: () => void;
  density: DeviceGridDensity;
  onDensityChange: (density: DeviceGridDensity) => void;
  announce: (message: string) => void;
};

export const GridControls = ({
  meta,
  state,
  columns,
  onFilterChange,
  onColumnToggle,
  onResetColumns,
  density,
  onDensityChange,
  announce,
}: GridControlsProps) => {
  const statusOptions = useMemo(
    () => [...new Set(meta?.filterOptions.statuses ?? [])].sort(),
    [meta?.filterOptions.statuses]
  );
  const conditionOptions = useMemo(
    () => [...new Set(meta?.filterOptions.conditions ?? [])].sort(),
    [meta?.filterOptions.conditions]
  );
  const offboardingOptions = useMemo(
    () => [...new Set(meta?.filterOptions.offboardingStatuses ?? [])].sort(),
    [meta?.filterOptions.offboardingStatuses]
  );

  const [assignedSearch, setAssignedSearch] = useState(state.filters.assignedTo ?? "");

  const appliedFiltersCount = useMemo(() => countActiveFilters(state.filters), [state.filters]);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-indigo-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
          Filters · {appliedFiltersCount} active
        </p>
        <button
          type="button"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200 hover:text-white/90"
          onClick={() => {
            onFilterChange({
              search: undefined,
              status: [],
              condition: [],
              assignedTo: undefined,
              offboardingStatus: [],
            });
            announce("Cleared all device grid filters");
            setAssignedSearch("");
          }}
        >
          Clear filters
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold uppercase tracking-widest text-white/70">
          Search
          <input
            type="search"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Search by serial, owner, or status"
            value={state.filters.search ?? ""}
            onChange={(event) => {
              onFilterChange({ search: event.target.value || undefined });
              announce(`Search updated to ${event.target.value || "all devices"}`);
            }}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-widest text-white/70">
          Assigned to
          <input
            type="text"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Type to filter by owner"
            value={assignedSearch}
            onChange={(event) => setAssignedSearch(event.target.value)}
            onBlur={() => {
              onFilterChange({ assignedTo: assignedSearch || undefined });
              if (assignedSearch) {
                announce(`Filtering devices assigned to ${assignedSearch}`);
              }
            }}
          />
        </label>
        <div className="space-y-2 text-xs font-semibold uppercase tracking-widest text-white/70">
          Status
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {statusOptions.slice(0, 6).map((status) => {
              const selected = state.filters.status?.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    const next = toggleListValue(state.filters.status, status);
                    onFilterChange({ status: next });
                    announce(
                      selected
                        ? `Removed status filter ${status}`
                        : `Added status filter ${status}`
                    );
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected
                      ? "bg-indigo-500/90 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                  aria-pressed={selected}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2 text-xs font-semibold uppercase tracking-widest text-white/70">
          Condition
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by condition">
            {conditionOptions.slice(0, 6).map((condition) => {
              const selected = state.filters.condition?.includes(condition);
              return (
                <button
                  key={condition}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected
                      ? "bg-emerald-500/90 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                  onClick={() => {
                    const next = toggleListValue(state.filters.condition, condition);
                    onFilterChange({ condition: next });
                    announce(
                      selected
                        ? `Removed condition filter ${condition}`
                        : `Added condition filter ${condition}`
                    );
                  }}
                  aria-pressed={selected}
                >
                  {condition}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2 text-xs font-semibold uppercase tracking-widest text-white/70">
          Offboarding
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by offboarding status">
            {offboardingOptions.slice(0, 6).map((value) => {
              const selected = state.filters.offboardingStatus?.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected
                      ? "bg-amber-500/90 text-slate-900"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                  onClick={() => {
                    const next = toggleListValue(state.filters.offboardingStatus, value);
                    onFilterChange({ offboardingStatus: next });
                    announce(
                      selected
                        ? `Removed offboarding filter ${value}`
                        : `Added offboarding filter ${value}`
                    );
                  }}
                  aria-pressed={selected}
                >
                  {value}
                </button>
              );
            })}
            {!offboardingOptions.length && (
              <p className="text-xs normal-case text-white/50">No offboarding data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Columns</p>
        <div
          className="mt-3 grid gap-2 md:grid-cols-2"
          role="group"
          aria-label="Toggle column visibility"
        >
          {columns.map((column) => {
            const visible = column.visible !== false;
            return (
              <label
                key={column.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:border-white/30"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/40 bg-transparent text-indigo-400 focus:ring-indigo-400"
                  checked={visible}
                  onChange={(event) => {
                    onColumnToggle(column.id, event.target.checked);
                    announce(
                      event.target.checked
                        ? `Column ${column.label} is now visible`
                        : `Column ${column.label} hidden`
                    );
                  }}
                />
                <span className="font-medium">{column.label}</span>
                {column.governance?.anonymized && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-200">
                    Obscured
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            onResetColumns();
            announce("Column presets restored");
          }}
          className="mt-3 rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:border-white/50 hover:text-white"
        >
          Reset columns
        </button>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Density</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            { id: "comfortable" as DeviceGridDensity, label: "Comfortable", detail: "56px rows" },
            { id: "compact" as DeviceGridDensity, label: "Compact", detail: "44px rows" },
          ].map((option) => {
            const active = density === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onDensityChange(option.id);
                  announce(`Grid density set to ${option.label}`);
                }}
                aria-pressed={active}
                className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left text-sm transition ${
                  active
                    ? "border-indigo-400 bg-indigo-500/20 text-white"
                    : "border-white/15 bg-white/5 text-white/80 hover:border-white/30"
                }`}
              >
                <span className="font-semibold">{option.label}</span>
                <span className="text-xs text-white/70">{option.detail}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GridControls;
