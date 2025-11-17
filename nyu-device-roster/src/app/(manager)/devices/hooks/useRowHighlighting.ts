'use client';

import { useEffect, useMemo, useState } from "react";
import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";
import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

const shouldAnimate = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const deriveHighlightIds = (rows: DeviceGridDevice[]): Set<string> =>
  new Set(rows.map((row) => row.deviceId));

export const useRowHighlighting = (
  rows: DeviceGridDevice[],
  filters: DeviceGridQueryFilters
): Set<string> => {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const activeFilterFingerprint = useMemo(
    () => JSON.stringify(filters),
    [filters]
  );

  useEffect(() => {
    const rowIds = deriveHighlightIds(rows);
    const shouldPulse = shouldAnimate();
    setHighlighted(rowIds);

    if (!shouldPulse) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlighted(new Set());
    }, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFilterFingerprint, rows]);

  return highlighted;
};

export default useRowHighlighting;
