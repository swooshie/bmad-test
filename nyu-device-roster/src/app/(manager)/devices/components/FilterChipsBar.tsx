'use client';

import type { DeviceFilterChip } from "../utils/filter-chips";
import { FilterChip } from "./FilterChip";

type FilterChipsBarProps = {
  chips: DeviceFilterChip[];
  onRemove: (chip: DeviceFilterChip) => void;
  onReorder: (orderedIds: string[]) => void;
  onClearAll: () => void;
  announce: (message: string) => void;
};

const moveChip = (orderedIds: string[], chipId: string, direction: "left" | "right") => {
  const currentIndex = orderedIds.indexOf(chipId);
  if (currentIndex === -1) {
    return orderedIds;
  }
  const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= orderedIds.length) {
    return orderedIds;
  }
  const next = [...orderedIds];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
};

export const FilterChipsBar = ({
  chips,
  onRemove,
  onReorder,
  onClearAll,
  announce,
}: FilterChipsBarProps) => {
  if (!chips.length) {
    return null;
  }

  return (
    <section
      aria-label="Active filter chips"
      className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3 shadow-inner shadow-indigo-900/40"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100">
        <span>Active filters</span>
        <button
          type="button"
          onClick={() => {
            onClearAll();
            announce("Cleared all filter chips");
          }}
          className="text-indigo-100 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2" role="list">
        {chips.map((chip, index) => (
          <FilterChip
            key={chip.id}
            chip={chip}
            index={index}
            total={chips.length}
            onRemove={onRemove}
            onMoveLeft={(chipId) => onReorder(moveChip(chips.map((c) => c.id), chipId, "left"))}
            onMoveRight={(chipId) => onReorder(moveChip(chips.map((c) => c.id), chipId, "right"))}
            announce={announce}
          />
        ))}
      </div>
    </section>
  );
};

export default FilterChipsBar;
