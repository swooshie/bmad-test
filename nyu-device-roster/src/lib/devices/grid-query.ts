import type { ReadonlyURLSearchParams } from "next/navigation";

export type SortDirection = "asc" | "desc";

export type DeviceGridQueryFilters = {
  search?: string;
  status?: string[];
  condition?: string[];
  assignedTo?: string;
  offboardingStatus?: string[];
};

export type DeviceGridQueryState = {
  page: number;
  pageSize: number;
  sortBy: DeviceSortableField;
  sortDirection: SortDirection;
  filters: DeviceGridQueryFilters;
  chipOrder: string[];
};

export type DeviceSortableField =
  | "deviceId"
  | "assignedTo"
  | "status"
  | "condition"
  | "offboardingStatus"
  | "lastSeen"
  | "lastSyncedAt";

const SORTABLE_FIELDS = new Set<DeviceSortableField>([
  "deviceId",
  "assignedTo",
  "status",
  "condition",
  "offboardingStatus",
  "lastSeen",
  "lastSyncedAt",
]);

export const DEFAULT_DEVICE_GRID_STATE: DeviceGridQueryState = {
  page: 1,
  pageSize: 50,
  sortBy: "lastSyncedAt",
  sortDirection: "desc",
  filters: {},
  chipOrder: [],
};

const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

const normalizeString = (value: string | null | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const parseNumber = (value: string | null, fallback: number, options?: { min?: number; max?: number }) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(parsed, min), max);
};

const parseListParam = (value: string | null) => {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
};

const buildListParam = (values?: string[]) => {
  if (!values || !values.length) {
    return undefined;
  }
  return values.join(",");
};

const normalizeSortField = (value: string | null): DeviceSortableField => {
  if (!value) return DEFAULT_DEVICE_GRID_STATE.sortBy;
  if (SORTABLE_FIELDS.has(value as DeviceSortableField)) {
    return value as DeviceSortableField;
  }
  return DEFAULT_DEVICE_GRID_STATE.sortBy;
};

const normalizeSortDirection = (value: string | null): SortDirection => {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return DEFAULT_DEVICE_GRID_STATE.sortDirection;
};

export type SupportedSearchParams =
  | URLSearchParams
  | ReadonlyURLSearchParams
  | Record<string, string | string[] | undefined>;

export const parseDeviceGridSearchParams = (params?: SupportedSearchParams): DeviceGridQueryState => {
  if (!params) {
    return { ...DEFAULT_DEVICE_GRID_STATE };
  }

  const getValue = (key: string): string | null => {
    if (params instanceof URLSearchParams || isReadonlyParams(params)) {
      return params.get(key);
    }
    const raw = params[key];
    if (Array.isArray(raw)) {
      return raw[0] ?? null;
    }
    return raw ?? null;
  };

  return {
    page: parseNumber(getValue("page"), DEFAULT_DEVICE_GRID_STATE.page, { min: 1 }),
    pageSize: parseNumber(getValue("pageSize"), DEFAULT_DEVICE_GRID_STATE.pageSize, {
      min: MIN_PAGE_SIZE,
      max: MAX_PAGE_SIZE,
    }),
    sortBy: normalizeSortField(getValue("sort")),
    sortDirection: normalizeSortDirection(getValue("direction")),
    filters: {
      search: normalizeString(getValue("search")),
      status: parseListParam(getValue("status")),
      condition: parseListParam(getValue("condition")),
      assignedTo: normalizeString(getValue("assignedTo")),
      offboardingStatus: parseListParam(getValue("offboardingStatus")),
    },
    chipOrder: parseListParam(getValue("chipOrder")) ?? [],
  };
};

const isReadonlyParams = (
  value: SupportedSearchParams
): value is ReadonlyURLSearchParams & { get(key: string): string | null } => {
  return typeof (value as ReadonlyURLSearchParams).get === "function";
};

export const buildDeviceGridSearchParams = (state: DeviceGridQueryState): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", state.page.toString());
  params.set("pageSize", state.pageSize.toString());
  params.set("sort", state.sortBy);
  params.set("direction", state.sortDirection);

  const { filters } = state;
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.assignedTo) {
    params.set("assignedTo", filters.assignedTo);
  }
  const statusParam = buildListParam(filters.status);
  if (statusParam) {
    params.set("status", statusParam);
  }
  const conditionParam = buildListParam(filters.condition);
  if (conditionParam) {
    params.set("condition", conditionParam);
  }
  const offboardingParam = buildListParam(filters.offboardingStatus);
  if (offboardingParam) {
    params.set("offboardingStatus", offboardingParam);
  }
  const chipOrderParam = buildListParam(state.chipOrder);
  if (chipOrderParam) {
    params.set("chipOrder", chipOrderParam);
  }

  return params;
};

export const mergeDeviceGridState = (
  base: DeviceGridQueryState,
  update: Partial<DeviceGridQueryState> & { filters?: Partial<DeviceGridQueryFilters> }
): DeviceGridQueryState => {
  const filters: DeviceGridQueryFilters = {
    ...base.filters,
    ...(update.filters ?? {}),
  };
  const chipOrder = update.chipOrder ?? base.chipOrder ?? [];

  return {
    page: update.page ?? base.page,
    pageSize: update.pageSize ?? base.pageSize,
    sortBy: update.sortBy ?? base.sortBy,
    sortDirection: update.sortDirection ?? base.sortDirection,
    filters: Object.fromEntries(
      Object.entries(filters).filter(([, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return Boolean(value);
      })
    ) as DeviceGridQueryFilters,
    chipOrder,
  };
};
