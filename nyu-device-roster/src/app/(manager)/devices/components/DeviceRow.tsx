'use client';

import { useRef } from "react";
import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";
import GovernanceBadge from "@/app/(manager)/components/GovernanceBadge";

import type { DeviceColumn } from "../types";

const formatDate = (value: string | null) => {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const resolveCellValue = (row: DeviceGridDevice, columnId: DeviceColumn["id"]) => {
  switch (columnId) {
    case "serial":
      return (
        <div className="flex items-center gap-2">
          <span>{row.serial}</span>
          <GovernanceBadge serial={row.serial} cue={row.governanceCue} />
        </div>
      );
    case "legacyDeviceId":
      return row.legacyDeviceId ?? "—";
    case "assignedTo":
      return row.assignedTo;
    case "status":
      return row.status;
    case "condition":
      return (
        <span
          className={
            row.governanceCue.reasons.includes("condition") ? "font-semibold text-rose-200" : undefined
          }
        >
          {row.condition}
        </span>
      );
    case "offboardingStatus":
      return (
        <span
          className={
            row.governanceCue.reasons.includes("offboarding")
              ? "font-semibold text-amber-200"
              : "text-white/80"
          }
        >
          {row.offboardingStatus ?? "—"}
        </span>
      );
    case "lastSeen":
      return formatDate(row.lastSeen);
    case "lastSyncedAt":
      return formatDate(row.lastSyncedAt);
    case "sheetId":
      return row.sheetId;
    default: {
      const dynamicValue = row.dynamicAttributes?.[columnId];
      if (dynamicValue === undefined || dynamicValue === null) {
        return "—";
      }
      if (typeof dynamicValue === "number") {
        return dynamicValue.toString();
      }
      if (typeof dynamicValue === "boolean") {
        return dynamicValue ? "Yes" : "No";
      }
      return String(dynamicValue);
    }
  }
};

type DeviceRowProps = {
  row: DeviceGridDevice;
  columns: DeviceColumn[];
  virtualIndex: number;
  rowNumber: number;
  isFocused: boolean;
  onFocus: () => void;
  isSelected?: boolean;
  onSelect?: (row: DeviceGridDevice, element: HTMLDivElement | null) => void;
  isHighlighted?: boolean;
  rowHeight: number;
  gridTemplateColumns: string;
  gridMinWidth: number;
};

export const DeviceRow = ({
  row,
  columns,
  virtualIndex,
  rowNumber,
  isFocused,
  onFocus,
  isSelected,
  onSelect,
  isHighlighted,
  rowHeight,
  gridTemplateColumns,
  gridMinWidth,
}: DeviceRowProps) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const severityAccent =
    row.governanceCue.severity === "critical"
      ? "border-l-4 border-l-rose-500/80"
      : row.governanceCue.severity === "attention"
        ? "border-l-4 border-l-amber-400/80"
        : "border-l border-l-transparent";
  const haloClass = isHighlighted
    ? "ring-2 ring-violet-400/70 shadow-[0_0_25px_rgba(139,92,246,0.35)] transition"
    : "";

  return (
    <div
      role="row"
      className={`grid items-center border-b border-white/5 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${severityAccent} ${
        isSelected ? "bg-indigo-500/10 ring-1 ring-indigo-400/50" : virtualIndex % 2 === 0 ? "bg-white/5" : "bg-transparent"
      } ${haloClass}`}
      style={{
        minHeight: rowHeight,
        gridTemplateColumns,
        minWidth: `${gridMinWidth}px`,
      }}
      tabIndex={isFocused ? 0 : -1}
      aria-rowindex={rowNumber}
      aria-selected={isSelected}
      onFocus={onFocus}
      onClick={() => onSelect?.(row, rowRef.current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(row, rowRef.current);
        }
      }}
      data-testid="device-grid-row"
      ref={rowRef}
    >
      {columns.map((column, colIndex) => (
        <div
          key={column.id}
          role="gridcell"
          aria-colindex={colIndex + 1}
          className={`truncate ${
            column.numeric ? "text-right font-semibold" : "text-left"
          }`}
        >
          {resolveCellValue(row, column.id)}
        </div>
      ))}
    </div>
  );
};

export default DeviceRow;
