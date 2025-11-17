'use client';

import { useCallback, useId, useMemo, useState } from "react";

import type { GovernanceCue } from "@/lib/governance/cues";
import type { SerializedOffboardingMetadata } from "@/app/api/devices/device-query-service";
import { API_ROUTES } from "@/lib/routes";

type DeviceDetailPayload = {
  data: {
    device: {
      deviceId: string;
      governanceCue: GovernanceCue;
      lastTransferNotes: string | null;
      offboardingMetadata?: SerializedOffboardingMetadata;
      offboardingStatus: string | null;
      condition: string;
      updatedAt: string;
    };
  } | null;
  error: { code: string; message: string } | null;
};

type GovernanceBadgeTooltipProps = {
  deviceId: string;
  cueSummary: string;
  badge: React.ReactNode;
};

export const GovernanceBadgeTooltip = ({ deviceId, cueSummary, badge }: GovernanceBadgeTooltipProps) => {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detail, setDetail] = useState<DeviceDetailPayload["data"]["device"] | null>(null);

  const fetchDetails = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(API_ROUTES.deviceDetail(deviceId), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as DeviceDetailPayload;
      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? "Unable to load governance metadata");
      }
      setDetail(payload.data?.device ?? null);
      setStatus("ready");
    } catch (error) {
      console.error("Governance tooltip fetch failed", error);
      setStatus("error");
    }
  }, [deviceId]);

  const openTooltip = useCallback(() => {
    setIsOpen(true);
    if (status === "idle") {
      void fetchDetails();
    }
  }, [fetchDetails, status]);

  const closeTooltip = useCallback(() => {
    setIsOpen(false);
  }, []);

  const tooltipContent = useMemo(() => {
    if (status === "loading") {
      return <p className="text-xs text-white/80">Loading governance notes…</p>;
    }
    if (status === "error") {
      return (
        <div className="space-y-2 text-xs text-rose-100">
          <p>Unable to load governance metadata.</p>
          <button
            type="button"
            className="rounded border border-rose-200/40 px-2 py-1 text-[11px] uppercase tracking-widest"
            onClick={() => void fetchDetails()}
          >
            Retry
          </button>
        </div>
      );
    }
    if (!detail) {
      return <p className="text-xs text-white/70">No transfer notes yet. Flags track new cues automatically.</p>;
    }

    return (
      <div className="space-y-2 text-xs text-white/90">
        <p className="font-semibold uppercase tracking-widest text-indigo-200">{cueSummary}</p>
        <dl className="space-y-1 text-white/80">
          <div className="flex justify-between gap-4">
            <dt className="text-white/60">Offboarding</dt>
            <dd className="text-right font-semibold">{detail.offboardingStatus ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/60">Condition</dt>
            <dd className="text-right font-semibold">{detail.condition}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/60">Actor</dt>
            <dd className="text-right">{detail.offboardingMetadata?.lastActor ?? "Unassigned"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/60">Timestamp</dt>
            <dd className="text-right">
              {detail.offboardingMetadata?.lastTransferAt
                ? new Date(detail.offboardingMetadata.lastTransferAt).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="rounded border border-white/10 bg-white/5 p-2 text-[11px] text-white/80">
          {detail.lastTransferNotes ?? "No transfer notes recorded yet."}
        </p>
      </div>
    );
  }, [cueSummary, detail, fetchDetails, status]);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      onFocusCapture={openTooltip}
      onBlurCapture={closeTooltip}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeTooltip();
        }
      }}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/90 shadow-sm transition hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-describedby={isOpen ? tooltipId : undefined}
      >
        {badge}
        <span className="sr-only">{cueSummary}</span>
      </button>
      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-[calc(100%+6px)] z-20 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl"
        >
          {tooltipContent}
        </div>
      )}
    </span>
  );
};

export default GovernanceBadgeTooltip;
