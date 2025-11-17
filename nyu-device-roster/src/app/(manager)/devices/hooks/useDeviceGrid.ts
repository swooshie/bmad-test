'use client';

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { API_ROUTES } from "@/lib/routes";
import {
  DEFAULT_DEVICE_GRID_STATE,
  buildDeviceGridSearchParams,
  mergeDeviceGridState,
  parseDeviceGridSearchParams,
  type DeviceGridQueryFilters,
} from "@/lib/devices/grid-query";
import {
  buildFilterChips,
  normalizeChipOrder,
  removeChipFromFilters,
  type DeviceFilterChip,
} from "../utils/filter-chips";

import type {
  DeviceGridDevice,
  DeviceGridMeta,
} from "@/app/api/devices/device-query-service";
import { DEVICE_COLUMNS, type DeviceColumn, type DeviceColumnId } from "../types";

const COLUMN_STORAGE_KEY = "nyu-device-grid-columns:v1";

type DeviceGridResponse =
  | {
      data: {
        devices: DeviceGridDevice[];
      };
      meta: DeviceGridMeta;
      error: null;
    }
  | {
      data: null;
      meta: null;
      error: { code: string; message: string };
    };

const persistColumns = (columns: DeviceColumn[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    COLUMN_STORAGE_KEY,
    JSON.stringify(
      columns.map((column) => ({
        id: column.id,
        visible: column.visible !== false,
      }))
    )
  );
};

const hydrateColumns = (): DeviceColumn[] => {
  if (typeof window === "undefined") {
    return DEVICE_COLUMNS;
  }
  const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY);
  if (!stored) {
    return DEVICE_COLUMNS;
  }
  try {
    const parsed = JSON.parse(stored) as Array<{ id: DeviceColumnId; visible: boolean }>;
    return DEVICE_COLUMNS.map((column) => {
      const storedColumn = parsed.find((entry) => entry.id === column.id);
      if (!storedColumn) {
        return column;
      }
      return {
        ...column,
        visible: storedColumn.visible,
      };
    });
  } catch {
    return DEVICE_COLUMNS;
  }
};

export type UseDeviceGridResult = {
  rows: DeviceGridDevice[];
  meta: DeviceGridMeta | null;
  isLoading: boolean;
  error: string | null;
  state: ReturnType<typeof parseDeviceGridSearchParams>;
  columns: DeviceColumn[];
  visibleColumns: DeviceColumn[];
  liveMessage: string;
  updateLiveMessage: (message: string) => void;
  activeFilterChips: DeviceFilterChip[];
  refresh: () => void;
  setPage: (page: number) => void;
  setSort: (columnId: DeviceColumnId) => void;
  setFilters: (filters: Partial<DeviceGridQueryFilters>) => void;
  clearFilters: () => void;
  removeFilterChip: (chip: DeviceFilterChip) => void;
  reorderFilterChips: (orderedIds: string[]) => void;
  setColumnVisibility: (columnId: DeviceColumnId, visible: boolean) => void;
  resetColumns: () => void;
};

export function useDeviceGrid(): UseDeviceGridResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const queryState = useMemo(() => {
    return mergeDeviceGridState(
      DEFAULT_DEVICE_GRID_STATE,
      parseDeviceGridSearchParams(searchParams ?? undefined)
    );
  }, [searchParams]);

  const [columns, setColumns] = useState<DeviceColumn[]>(() => DEVICE_COLUMNS);
  const [liveMessage, setLiveMessage] = useState("Device grid ready");

  useEffect(() => {
    setColumns(hydrateColumns());
  }, []);

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible !== false),
    [columns]
  );

  const updateQueryState = useCallback(
    (partial: Parameters<typeof mergeDeviceGridState>[1]) => {
      const merged = mergeDeviceGridState(queryState, partial);
      const params = buildDeviceGridSearchParams(merged);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, queryState, router]
  );

  const setColumnVisibility = useCallback((columnId: DeviceColumnId, visible: boolean) => {
    setColumns((current) => {
      const next = current.map((column) =>
        column.id === columnId ? { ...column, visible } : column
      );
      persistColumns(next);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    persistColumns(DEVICE_COLUMNS);
    setColumns(DEVICE_COLUMNS);
  }, []);

  const queryKey = useMemo(
    () => ["devices-grid", buildDeviceGridSearchParams(queryState).toString()],
    [queryState]
  );

  const fetchGrid = useCallback(async () => {
    const queryString = buildDeviceGridSearchParams(queryState).toString();
    const response = await fetch(`${API_ROUTES.devices}?${queryString}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = (await response.json()) as DeviceGridResponse;
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message ?? "Failed to load devices");
    }
    return payload;
  }, [queryState]);

  const {
    data,
    isFetching,
    refetch,
    error: queryError,
  } = useQuery<DeviceGridResponse>({
    queryKey,
    queryFn: fetchGrid,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  const rows = data?.data.devices ?? [];
  const meta = data?.meta ?? null;
  const isLoading = isFetching && !data;
  const error = queryError instanceof Error ? queryError.message : null;

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const setPage = useCallback(
    (page: number) => {
      updateQueryState({ page: Math.max(1, page) });
    },
    [updateQueryState]
  );

  const setSort = useCallback(
    (columnId: DeviceColumnId) => {
      const nextDirection =
        queryState.sortBy === columnId && queryState.sortDirection === "asc" ? "desc" : "asc";
      updateQueryState({ sortBy: columnId, sortDirection: nextDirection });
    },
    [queryState.sortBy, queryState.sortDirection, updateQueryState]
  );

  const setFilters = useCallback(
    (filters: Partial<DeviceGridQueryFilters>) => {
      const mergedFilters = mergeDeviceGridState(queryState, { filters }).filters;
      const nextChips = buildFilterChips(mergedFilters, meta, queryState.chipOrder);
      const nextOrder = normalizeChipOrder(
        queryState.chipOrder,
        nextChips.map((chip) => chip.id)
      );
      updateQueryState({ page: 1, filters: mergedFilters, chipOrder: nextOrder });
    },
    [meta, queryState, updateQueryState]
  );

  const clearFilters = useCallback(() => {
    updateQueryState({ page: 1, filters: {}, chipOrder: [] });
    setLiveMessage("Cleared all filters");
  }, [updateQueryState]);

  const activeFilterChips = useMemo(
    () => buildFilterChips(queryState.filters, meta, queryState.chipOrder),
    [meta, queryState.chipOrder, queryState.filters]
  );

  const removeFilterChip = useCallback(
    (chip: DeviceFilterChip) => {
      const nextFilters = removeChipFromFilters(queryState.filters, chip);
      const nextChips = buildFilterChips(nextFilters, meta, queryState.chipOrder);
      const nextOrder = normalizeChipOrder(
        queryState.chipOrder.filter((id) => id !== chip.id),
        nextChips.map((entry) => entry.id)
      );
      updateQueryState({ page: 1, filters: nextFilters, chipOrder: nextOrder });
      setLiveMessage(`Removed filter ${chip.label}`);
    },
    [meta, queryState.chipOrder, queryState.filters, updateQueryState]
  );

  const reorderFilterChips = useCallback(
    (orderedIds: string[]) => {
      const nextOrder = normalizeChipOrder(
        orderedIds,
        activeFilterChips.map((chip) => chip.id)
      );
      updateQueryState({ chipOrder: nextOrder });
    },
    [activeFilterChips, updateQueryState]
  );

  return {
    rows,
    meta,
    isLoading,
    error,
    state: queryState,
    columns,
    visibleColumns,
    liveMessage,
    updateLiveMessage: setLiveMessage,
    activeFilterChips,
    refresh,
    setPage,
    setSort,
    setFilters,
    clearFilters,
    removeFilterChip,
    reorderFilterChips,
    setColumnVisibility,
    resetColumns,
  };
}
