import type { DeviceGridMeta } from "@/app/api/devices/device-query-service";
import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

export type DeviceFilterChipType =
  | "search"
  | "status"
  | "condition"
  | "assignedTo"
  | "offboardingStatus";

export type DeviceFilterChip = {
  id: string;
  type: DeviceFilterChipType;
  value: string;
  label: string;
  count: number | null;
};

const DEFAULT_TYPE_ORDER: DeviceFilterChipType[] = [
  "search",
  "assignedTo",
  "status",
  "condition",
  "offboardingStatus",
];

const buildChipId = (type: DeviceFilterChipType, value: string) => `${type}:${value}`;

const normalizeValueList = (values?: string[] | null) =>
  values?.filter((value) => value && value.trim().length > 0) ?? [];

export const buildFilterChips = (
  filters: DeviceGridQueryFilters,
  meta: DeviceGridMeta | null,
  chipOrder: string[]
): DeviceFilterChip[] => {
  const chips: DeviceFilterChip[] = [];
  const totalCount = meta?.total ?? null;

  if (filters.search) {
    chips.push({
      id: buildChipId("search", filters.search),
      type: "search",
      value: filters.search,
      label: `Search: ${filters.search}`,
      count: totalCount,
    });
  }

  if (filters.assignedTo) {
    chips.push({
      id: buildChipId("assignedTo", filters.assignedTo),
      type: "assignedTo",
      value: filters.assignedTo,
      label: `Assigned: ${filters.assignedTo}`,
      count: totalCount,
    });
  }

  normalizeValueList(filters.status).forEach((value) => {
    chips.push({
      id: buildChipId("status", value),
      type: "status",
      value,
      label: `Status: ${value}`,
      count: totalCount,
    });
  });

  normalizeValueList(filters.condition).forEach((value) => {
    chips.push({
      id: buildChipId("condition", value),
      type: "condition",
      value,
      label: `Condition: ${value}`,
      count: totalCount,
    });
  });

  normalizeValueList(filters.offboardingStatus).forEach((value) => {
    chips.push({
      id: buildChipId("offboardingStatus", value),
      type: "offboardingStatus",
      value,
      label: `Offboarding: ${value}`,
      count: totalCount,
    });
  });

  const explicitOrder = chipOrder.filter((id) => chips.some((chip) => chip.id === id));
  const remaining = chips.filter((chip) => !explicitOrder.includes(chip.id));

  const defaultSort = (typeA: DeviceFilterChipType, typeB: DeviceFilterChipType) =>
    DEFAULT_TYPE_ORDER.indexOf(typeA) - DEFAULT_TYPE_ORDER.indexOf(typeB);

  const orderedRemaining = remaining.sort((a, b) => {
    const typeComparison = defaultSort(a.type, b.type);
    if (typeComparison !== 0) {
      return typeComparison;
    }
    return a.value.localeCompare(b.value);
  });

  return [...explicitOrder.map((id) => chips.find((chip) => chip?.id === id)! ), ...orderedRemaining];
};

export const removeChipFromFilters = (
  filters: DeviceGridQueryFilters,
  chip: DeviceFilterChip
): DeviceGridQueryFilters => {
  if (chip.type === "search") {
    const { search, ...rest } = filters;
    return { ...rest };
  }
  if (chip.type === "assignedTo") {
    const { assignedTo, ...rest } = filters;
    return { ...rest };
  }

  const nextFilters: DeviceGridQueryFilters = { ...filters };
  const listKey =
    chip.type === "status"
      ? "status"
      : chip.type === "condition"
        ? "condition"
        : "offboardingStatus";
  const currentList = normalizeValueList(filters[listKey]);
  nextFilters[listKey] = currentList.filter((value) => value !== chip.value);

  if (!nextFilters[listKey]?.length) {
    delete nextFilters[listKey];
  }

  return nextFilters;
};

export const normalizeChipOrder = (
  chipOrder: string[],
  availableChipIds: string[]
): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  chipOrder.forEach((id) => {
    if (availableChipIds.includes(id) && !seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  });

  availableChipIds.forEach((id) => {
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  });

  return normalized;
};
