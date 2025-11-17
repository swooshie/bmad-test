'use client';

import type { DeviceGridMeta } from "@/app/api/devices/device-query-service";
import type {
  DeviceGridQueryFilters,
  DeviceGridQueryState,
} from "@/lib/devices/grid-query";
import { RISKY_CONDITIONS } from "@/lib/governance/cues";
import { toggleListValue } from "../utils/filter-helpers";

type GovernanceFilterChipsProps = {
  meta: DeviceGridMeta | null;
  state: DeviceGridQueryState;
  onFilterChange: (filters: Partial<DeviceGridQueryFilters>) => void;
  announce: (message: string) => void;
};

const buildQueryList = (values: string[] | undefined, next: string) =>
  toggleListValue(values, next);

export const GovernanceFilterChips = ({
  meta,
  state,
  onFilterChange,
  announce,
}: GovernanceFilterChipsProps) => {
  const flaggedConditions = (meta?.filterOptions.conditions ?? []).filter((condition) =>
    RISKY_CONDITIONS.includes(condition)
  );
  const flaggedOffboarding = (meta?.filterOptions.offboardingStatuses ?? [])
    .filter((status) => status && status.trim().length > 0)
    .slice(0, 5);

  if (!flaggedConditions.length && !flaggedOffboarding.length) {
    return null;
  }

  const applyFlaggedPreset = () => {
    onFilterChange({
      condition: flaggedConditions,
      offboardingStatus: flaggedOffboarding,
    });
    announce("Applied flagged device preset filters");
  };

  return (
    <section className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
            Governance Filters
          </p>
          <p className="text-xs text-white/70">Tap chips to isolate risky devices instantly.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-amber-200/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-100 hover:border-amber-100 hover:text-white"
          onClick={applyFlaggedPreset}
        >
          Flagged devices
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {flaggedConditions.map((condition) => {
          const selected = state.filters.condition?.includes(condition) ?? false;
          return (
            <button
              key={condition}
              type="button"
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                selected
                  ? "bg-rose-500/80 text-white shadow-lg"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
              aria-pressed={selected}
              onClick={() => {
                const next = buildQueryList(state.filters.condition, condition);
                onFilterChange({ condition: next });
                announce(
                  selected
                    ? `Removed condition filter ${condition}`
                    : `Added condition filter ${condition}`
                );
              }}
            >
              Condition: {condition}
            </button>
          );
        })}

        {flaggedOffboarding.map((status) => {
          const selected = state.filters.offboardingStatus?.includes(status) ?? false;
          return (
            <button
              key={status}
              type="button"
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                selected
                  ? "bg-amber-500/80 text-slate-900 shadow-lg"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
              aria-pressed={selected}
              onClick={() => {
                const next = buildQueryList(state.filters.offboardingStatus, status);
                onFilterChange({ offboardingStatus: next });
                announce(
                  selected
                    ? `Removed offboarding filter ${status}`
                    : `Added offboarding filter ${status}`
                );
              }}
            >
              Offboarding: {status}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default GovernanceFilterChips;
