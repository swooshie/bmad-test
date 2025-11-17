"use client";

import { useEffect, useMemo, useState } from "react";

import type { SyncStatusState } from "@/lib/sync-status";
import { useSyncStatus } from "@/lib/use-sync-status";

import { useManagerSession } from "./manager-session-context";
import { useAnonymizationState } from "../devices/state/anonymization-store";

const variantStyles: Record<SyncStatusState["state"], string> = {
  idle: "border-white/20 bg-slate-900 text-white",
  running: "border-amber-200/40 bg-amber-100/10 text-amber-100",
  success: "border-emerald-200/40 bg-emerald-100/10 text-emerald-100",
  error: "border-rose-200/40 bg-rose-100/10 text-rose-100",
};

const stateLabelMap: Record<SyncStatusState["state"], string> = {
  idle: "Idle",
  running: "Sync in progress",
  success: "Sync successful",
  error: "Sync failed",
};

const stateIcon = (state: SyncStatusState["state"]) => {
  switch (state) {
    case "success":
      return "✓";
    case "running":
      return "↻";
    case "error":
      return "!";
    default:
      return "•";
  }
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const describeStatus = (status: SyncStatusState) => {
  switch (status.state) {
    case "running":
      return `Manual sync started by ${status.requestedBy ?? "an operator"}.`;
    case "success":
      return `Added ${status.metrics.added}, updated ${status.metrics.updated}, unchanged ${status.metrics.unchanged}.`;
    case "error":
      return `Error ${status.errorCode}: ${status.message}`;
    default:
      return "Sync pipeline is standing by for the next scheduled run.";
  }
};

const effectiveTimestamp = (status: SyncStatusState) => {
  if (status.state === "running") {
    return status.startedAt;
  }
  if (status.state === "success" || status.state === "error") {
    return status.completedAt;
  }
  return undefined;
};

export const SyncStatusBanner = () => {
  const { email } = useManagerSession();
  const { status, isLoading, error: fetchError } = useSyncStatus({
    pollIntervalMs: 4000,
  });
  const anonymization = useAnonymizationState();
  const [optimisticStatus, setOptimisticStatus] = useState<SyncStatusState | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const effectiveStatus = optimisticStatus ?? status;

  useEffect(() => {
    if (!optimisticStatus) return;
    if (status.state === "running") {
      if (status.runId && status.runId === optimisticStatus.runId) {
        return;
      }
      return;
    }
    setOptimisticStatus(null);
  }, [optimisticStatus, status]);

  const bannerClasses = useMemo(() => {
    const variant = effectiveStatus.state ?? "idle";
    return `flex flex-col gap-4 rounded-2xl border px-5 py-4 transition ${
      variantStyles[variant] ?? variantStyles.idle
    }`;
  }, [effectiveStatus.state]);

  const handleManualRefresh = async () => {
    setIsTriggering(true);
    setCtaError(null);
    const optimisticRunId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `manual-${Date.now()}`;
    setOptimisticStatus({
      state: "running",
      runId: optimisticRunId,
      requestedBy: email ?? null,
      startedAt: new Date().toISOString(),
    });

    try {
      const response = await fetch("/api/sync/manual", {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Manual sync failed to start");
      }
    } catch (err) {
      setOptimisticStatus(null);
      setCtaError(err instanceof Error ? err.message : "Unable to start manual sync");
    } finally {
      setIsTriggering(false);
    }
  };

  if (fetchError) {
    return (
      <div className="rounded-2xl border border-rose-200/40 bg-rose-100/10 px-5 py-4 text-sm text-rose-100">
        Unable to load sync status: {fetchError}
      </div>
    );
  }

  return (
    <section
      className={bannerClasses}
      aria-live="polite"
      aria-busy={isLoading || isTriggering}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-base font-semibold"
          >
            {stateIcon(effectiveStatus.state)}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {stateLabelMap[effectiveStatus.state]}
            </p>
            <p className="mt-1 text-base font-medium text-white">
              {isLoading ? "Loading sync status…" : describeStatus(effectiveStatus)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {effectiveStatus.state === "error" && effectiveStatus.recommendation
                ? `Next step: ${effectiveStatus.recommendation}`
                : `Last update: ${formatTimestamp(effectiveTimestamp(effectiveStatus))}`}
              {effectiveStatus.state === "error" && effectiveStatus.referenceId
                ? ` · Ref ${effectiveStatus.referenceId}`
                : null}
              {` · Anonymization: ${anonymization.enabled ? "on" : "off"}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isTriggering}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Trigger manual roster refresh"
          >
            {isTriggering ? "Requesting sync…" : "Manual refresh"}
          </button>
          {ctaError ? (
            <p className="text-xs text-rose-200" role="alert">
              {ctaError}
            </p>
          ) : (
            <p className="text-xs text-white/60">
              Optimistic status updates within 200 ms. Latest operator:{" "}
              {effectiveStatus.requestedBy ?? "unavailable"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default SyncStatusBanner;
