import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

export const toggleListValue = (list: string[] | undefined, value: string): string[] => {
  const next = new Set(list ?? []);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return Array.from(next);
};

export const countActiveFilters = (filters: DeviceGridQueryFilters): number =>
  Object.values(filters).reduce((count, value) => {
    if (Array.isArray(value)) {
      return count + (value.length ? 1 : 0);
    }
    return count + (value ? 1 : 0);
  }, 0);
