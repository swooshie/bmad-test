import { describe, expect, it } from "vitest";

import {
  countActiveFilters,
  toggleListValue,
} from "@/app/(manager)/devices/utils/filter-helpers";

describe("filter helpers", () => {
  it("toggles list membership without duplicates", () => {
    expect(toggleListValue(undefined, "Assigned")).toEqual(["Assigned"]);
    expect(toggleListValue(["Assigned"], "Assigned")).toEqual([]);
    expect(toggleListValue(["Assigned"], "Available")).toEqual(["Assigned", "Available"]);
  });

  it("counts only populated filters", () => {
    const filters = {
      search: "demo",
      status: ["Assigned"],
      condition: [],
      assignedTo: "",
    };
    expect(countActiveFilters(filters)).toBe(2);
  });
});
