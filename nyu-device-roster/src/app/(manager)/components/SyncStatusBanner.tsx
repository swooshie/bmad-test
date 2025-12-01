"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { SyncStatusState, SyncTriggerType } from "@/lib/sync-status";
import { useSyncStatus } from "@/lib/use-sync-status";
import { usePerformanceMetrics } from "../devices/hooks/usePerformanceMetrics";

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

const describeTrigger = (trigger?: SyncTriggerType) => {
  switch (trigger) {
    case "manual":
      return "Manual";
    case "scheduled":
      return "Scheduled";
    default:
      return "System";
  }
};

const describeStatus = (status: SyncStatusState) => {
  switch (status.state) {
    case "running":
      return status.trigger === "manual"
        ? `Manual sync started by ${status.requestedBy ?? "an operator"}.`
        : `${describeTrigger(status.trigger)} sync in progress.`;
    case "success":
      return `${describeTrigger(status.trigger)} sync completed · Added ${status.metrics.added}, updated ${status.metrics.updated}, unchanged ${status.metrics.unchanged}, processed ${status.metrics.rowsProcessed} rows.`;
    case "error":
      return `${describeTrigger(status.trigger)} sync error ${status.errorCode}: ${status.message}`;
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
  const { status, isLoading, error: fetchError, refresh } = useSyncStatus({
    pollIntervalMs: 4000,
  });
  const anonymization = useAnonymizationState();
  const [optimisticStatus, setOptimisticStatus] = useState<SyncStatusState | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const refreshButtonRef = useRef<HTMLButtonElement | null>(null);
  const { recordInteraction } = usePerformanceMetrics({ anonymized: anonymization.enabled });

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

  useEffect(() => {
    if (effectiveStatus.state === "error") {
      alertRef.current?.focus({ preventScroll: true });
      setToast(`Sync failed (${effectiveStatus.errorCode})`);
      recordInteraction("sync-error", 0, 200, {
        code: effectiveStatus.errorCode,
        referenceId: effectiveStatus.referenceId ?? "n/a",
      });
    }
  }, [effectiveStatus, recordInteraction]);

  useEffect(() => {
    if (ctaError || fetchError) {
      setToast(ctaError ?? fetchError ?? null);
      alertRef.current?.focus({ preventScroll: true });
      recordInteraction("sync-error", 0, 200, {
        code: ctaError ? "CTA_ERROR" : "STATUS_FETCH_ERROR",
      });
    }
  }, [ctaError, fetchError, recordInteraction]);

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
    recordInteraction("manual-sync", 0, 200, { requestedBy: email ?? "unknown" });

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

  const handleRefreshStatus = () => {
    recordInteraction("sync-status-refresh", 0, 200, { source: "error-banner" });
    refresh?.();
  };

  if (fetchError) {
    return (
      <div
        className="rounded-2xl border border-rose-200/40 bg-rose-100/10 px-5 py-4 text-sm text-rose-100"
        role="alert"
        aria-live="assertive"
        ref={alertRef}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">Unable to load sync status: {fetchError}</p>
          <button
            type="button"
            ref={refreshButtonRef}
            onClick={handleRefreshStatus}
            className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40 hover:bg-white/10"
          >
            Retry
          </button>
        </div>
        <p className="mt-2 text-xs text-white/70">
          Focus returns to this banner for screen reader clarity. Reference the request ID from server logs if the error persists.
        </p>
      </div>
    );
  }

  return (
    <section className={bannerClasses} aria-live="polite" aria-busy={isLoading || isTriggering}>
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
            {effectiveStatus.warning ? (
              <p className="mt-1 text-xs text-amber-200" role="status">
                ⚠ {effectiveStatus.warning.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isTriggering}
            ref={refreshButtonRef}
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
              Optimistic status updates within 200 ms. Latest operator: {(() => {
                if (effectiveStatus.state === "idle") {
                  return "unavailable";
                }
                return (
                  effectiveStatus.requestedBy ??
                  (effectiveStatus.trigger === "scheduled"
                    ? "scheduler"
                    : effectiveStatus.trigger === "system"
                    ? "system"
                    : "unavailable")
                );
              })()}
            </p>
          )}
        </div>
      </div>
      {effectiveStatus.state === "error" ? (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-rose-200/40 bg-rose-100/10 px-4 py-3 text-sm text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
          aria-live="assertive"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Sync failed · Code {effectiveStatus.errorCode}</p>
              <button
                type="button"
                className="rounded-md border border-rose-200/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-50 transition hover:bg-rose-100/10"
                onClick={handleManualRefresh}
              >
                Retry sync
              </button>
            </div>
            <p className="text-xs text-rose-100/90">{effectiveStatus.message}</p>
            {effectiveStatus.recommendation ? (
              <p className="text-xs text-rose-100/80">Recommendation: {effectiveStatus.recommendation}</p>
            ) : null}
            {effectiveStatus.referenceId ? (
              <p className="text-[11px] text-rose-100/70">Reference: {effectiveStatus.referenceId}</p>
            ) : null}
            <p className="text-[11px] text-rose-100/70">
              Focus returns here to announce the alert; use Manual refresh to retry and return focus to your last control.
            </p>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-40 max-w-sm rounded-xl border border-white/10 bg-slate-950/90 px-4 py-3 text-sm text-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{toast}</p>
            <button
              type="button"
              className="text-xs uppercase tracking-[0.2em] text-indigo-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              onClick={() => setToast(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SyncStatusBanner;
