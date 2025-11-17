'use client';

import type { KeyboardEvent } from "react";
import type { DeviceFilterChip } from "../utils/filter-chips";

type FilterChipProps = {
  chip: DeviceFilterChip;
  index: number;
  total: number;
  onRemove: (chip: DeviceFilterChip) => void;
  onMoveLeft: (chipId: string) => void;
  onMoveRight: (chipId: string) => void;
  announce: (message: string) => void;
};

export const FilterChip = ({
  chip,
  index,
  total,
  onRemove,
  onMoveLeft,
  onMoveRight,
  announce,
}: FilterChipProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      onRemove(chip);
      announce(`Removed filter ${chip.label}`);
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      onMoveLeft(chip.id);
      announce(`Moved ${chip.label} earlier in order`);
    }
    if (event.key === "ArrowRight" && index < total - 1) {
      event.preventDefault();
      onMoveRight(chip.id);
      announce(`Moved ${chip.label} later in order`);
    }
  };

  return (
    <button
      type="button"
      className="group inline-flex items-center gap-2 rounded-full border border-indigo-400/60 bg-indigo-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-50 shadow-[0_0_0_1px_rgba(99,102,241,0.2)] transition hover:border-indigo-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      aria-pressed="true"
      aria-label={`${chip.label}${chip.count !== null ? ` (${chip.count} matches)` : ""}`}
      onClick={() => {
        onRemove(chip);
        announce(`Removed filter ${chip.label}`);
      }}
      onKeyDown={handleKeyDown}
      data-testid="filter-chip"
    >
      <span className="truncate">{chip.label}</span>
      {chip.count !== null && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/80">
          {chip.count}
        </span>
      )}
      <span
        aria-hidden="true"
        className="rounded-full bg-indigo-300/20 px-2 py-[2px] text-[10px] font-bold uppercase text-indigo-50 group-hover:bg-indigo-300/40"
      >
        ×
      </span>
    </button>
  );
};

export default FilterChip;
