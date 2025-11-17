import { describe, expect, it } from "vitest";

import {
  buildFilterChips,
  normalizeChipOrder,
  removeChipFromFilters,
} from "@/app/(manager)/devices/utils/filter-chips";
import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

const mockFilters: DeviceGridQueryFilters = {
  search: "ipad",
  status: ["Active", "Staged"],
  assignedTo: "Katie",
  offboardingStatus: ["Scheduled"],
};

describe("buildFilterChips", () => {
  it("creates chips for each filter value and respects chipOrder", () => {
    const chips = buildFilterChips(mockFilters, { total: 12 } as any, ["status:Staged"]);
    const labels = chips.map((chip) => chip.label);

    expect(labels).toContain("Search: ipad");
    expect(labels).toContain("Assigned: Katie");
    expect(labels).toContain("Status: Active");
    expect(labels[0]).toBe("Status: Staged");
    expect(chips.every((chip) => chip.count === 12)).toBe(true);
  });
});

describe("removeChipFromFilters", () => {
  it("removes list-based filters", () => {
    const chips = buildFilterChips(mockFilters, null, []);
    const statusChip = chips.find((chip) => chip.id === "status:Active");
    const nextFilters = removeChipFromFilters(mockFilters, statusChip!);
    expect(nextFilters.status).toEqual(["Staged"]);
  });

  it("removes scalar filters", () => {
    const chips = buildFilterChips(mockFilters, null, []);
    const searchChip = chips.find((chip) => chip.type === "search");
    const nextFilters = removeChipFromFilters(mockFilters, searchChip!);
    expect(nextFilters.search).toBeUndefined();
  });
});

describe("normalizeChipOrder", () => {
  it("drops missing ids and appends new ones", () => {
    const normalized = normalizeChipOrder(
      ["status:Active", "missing:id"],
      ["status:Active", "condition:Good"]
    );
    expect(normalized).toEqual(["status:Active", "condition:Good"]);
  });
});
