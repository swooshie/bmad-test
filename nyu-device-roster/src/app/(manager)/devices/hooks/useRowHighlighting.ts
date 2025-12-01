'use client';

import { useEffect, useMemo, useState } from "react";
import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";
import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";

const shouldAnimate = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const deriveHighlightIds = (rows: DeviceGridDevice[]): Set<string> =>
  new Set(rows.map((row) => row.serial));

export const useRowHighlighting = (
  rows: DeviceGridDevice[],
  filters: DeviceGridQueryFilters
): Set<string> => {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const activeFilterFingerprint = useMemo(
    () => JSON.stringify(filters),
    [filters]
  );

  const rowSerials = useMemo(() => rows.map((row) => row.serial), [rows]);
  const rowFingerprint = useMemo(() => rowSerials.join("|"), [rowSerials]);

  useEffect(() => {
    const rowIds = new Set(rowSerials);
    const shouldPulse = shouldAnimate();
    setHighlighted((prev) => {
      if (prev.size === rowIds.size && rowSerials.every((id) => prev.has(id))) {
        return prev;
      }
      return rowIds;
    });

    if (!shouldPulse) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlighted(new Set());
    }, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFilterFingerprint, rowFingerprint, rowSerials]);

  return highlighted;
};

export default useRowHighlighting;
