import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEVICE_GRID_STATE,
  buildDeviceGridSearchParams,
  mergeDeviceGridState,
  parseDeviceGridSearchParams,
} from "@/lib/devices/grid-query";

describe("grid-query utils", () => {
  it("parses search params with validation and defaults", () => {
    const params = new URLSearchParams({
      page: "-3",
      pageSize: "9999",
      sort: "invalid",
      direction: "up",
      search: " demo ",
      status: "Assigned,Available",
    });

    const parsed = parseDeviceGridSearchParams(params);

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(200);
    expect(parsed.sortBy).toBe(DEFAULT_DEVICE_GRID_STATE.sortBy);
    expect(parsed.sortDirection).toBe(DEFAULT_DEVICE_GRID_STATE.sortDirection);
    expect(parsed.filters.search).toBe("demo");
    expect(parsed.filters.status).toEqual(["Assigned", "Available"]);
  });

  it("builds query strings omitting empty filters", () => {
    const params = buildDeviceGridSearchParams({
      ...DEFAULT_DEVICE_GRID_STATE,
      page: 2,
      filters: {
        search: "alex",
        status: ["Assigned"],
      },
    });

    expect(params.get("page")).toBe("2");
    expect(params.get("search")).toBe("alex");
    expect(params.get("status")).toBe("Assigned");
    expect(params.get("condition")).toBeNull();
  });

  it("merges states and strips falsy filters", () => {
    const merged = mergeDeviceGridState(
      DEFAULT_DEVICE_GRID_STATE,
      {
        page: 3,
        filters: {
          search: "",
          status: ["Available"],
        },
      }
    );

    expect(merged.page).toBe(3);
    expect(merged.filters.status).toEqual(["Available"]);
    expect(merged.filters.search).toBeUndefined();
  });
});
