"use client";

import { useMemo } from "react";

import type { SyncStatusState } from "@/lib/sync-status";
import { useSyncStatus } from "@/lib/use-sync-status";

const variantClasses: Record<string, string> = {
  idle: "border-slate-200 bg-white text-slate-700",
  running: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

const statusMessage = (status: SyncStatusState) => {
  switch (status.state) {
    case "idle":
      return "Sync pipeline is idle.";
    case "running":
      return `Manual sync started by ${status.requestedBy ?? "an operator"}…`;
    case "success": {
      const schemaChanges = (status.metrics.columnsAdded ?? 0) + (status.metrics.columnsRemoved ?? 0);
      const versionNote =
        status.metrics.columnsVersion && schemaChanges > 0
          ? ` version ${status.metrics.columnsVersion}`
          : "";
      const columnChanges =
        schemaChanges > 0
          ? ` Column registry updated${versionNote} (added ${status.metrics.columnsAdded ?? 0}, removed ${status.metrics.columnsRemoved ?? 0}, total ${status.metrics.columnTotal ?? 0}).`
          : "";
      return `Last sync succeeded (added ${status.metrics.added}, updated ${status.metrics.updated}, unchanged ${status.metrics.unchanged}, serial conflicts ${status.metrics.serialConflicts}, legacy IDs updated ${status.metrics.legacyIdsUpdated}).${columnChanges}`;
    }
    case "error":
      return `Last sync failed (${status.errorCode}): ${status.message}`;
    default:
      return "Sync status unavailable.";
  }
};

export const SyncStatusBanner = () => {
  const { status, isLoading, error } = useSyncStatus({ pollIntervalMs: 4000 });

  const classes = useMemo(() => {
    const variant = status.state ?? "idle";
    return `rounded-2xl border px-4 py-3 text-sm font-medium transition ${variantClasses[variant] ?? variantClasses.idle}`;
  }, [status.state]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
        Unable to load sync status: {error}
      </div>
    );
  }

  return (
    <div className={classes} aria-live="polite">
      {isLoading ? "Loading sync status…" : statusMessage(status)}
    </div>
  );
};

export default SyncStatusBanner;
