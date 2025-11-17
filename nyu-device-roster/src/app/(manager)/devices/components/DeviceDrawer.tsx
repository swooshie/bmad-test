"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { API_ROUTES } from "@/lib/routes";
import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";
import { useDeviceSelection } from "../state/device-selection-store";
import { useAnonymizationState } from "../state/anonymization-store";
import { AuditTimeline } from "./AuditTimeline";
import { exportAuditSnapshot, initiateHandoff } from "../actions/deviceActions";

type DeviceDetail = {
  deviceId: string;
  assignedTo: string;
  condition: string;
  offboardingStatus: string | null;
  governanceCue: DeviceGridDevice["governanceCue"];
  lastTransferNotes: string | null;
  offboardingMetadata?: DeviceGridDevice["offboardingMetadata"];
  updatedAt: string;
};

type DeviceDetailResponse = {
  data: { device: DeviceDetail } | null;
  error: { code: string; message: string } | null;
};

const fetchDeviceDetail = async (deviceId: string): Promise<DeviceDetail> => {
  const response = await fetch(API_ROUTES.deviceDetail(deviceId), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as DeviceDetailResponse;
  if (!response.ok || payload.error || !payload.data?.device) {
    throw new Error(payload.error?.message ?? "Unable to load device details right now.");
  }
  return payload.data.device;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export function DeviceDrawer({ onClose }: { onClose: () => void }) {
  const { selectedDeviceId, isOpen } = useDeviceSelection();
  const { enabled: anonymized } = useAnonymizationState();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusableRef = useRef<HTMLButtonElement | null>(null);
  const handoffButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);

  const {
    data: device,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["device-detail", selectedDeviceId],
    queryFn: () => fetchDeviceDetail(selectedDeviceId ?? ""),
    enabled: Boolean(selectedDeviceId) && isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const focusable = [closeButtonRef.current, exportButtonRef.current, handoffButtonRef.current].filter(
          Boolean
        ) as HTMLElement[];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    (firstFocusableRef.current ?? closeButtonRef.current)?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const governanceAccent = useMemo(() => {
    if (!device?.governanceCue) return "bg-slate-800";
    if (device.governanceCue.severity === "critical") return "bg-rose-500/15";
    if (device.governanceCue.severity === "attention") return "bg-amber-500/15";
    return "bg-emerald-500/10";
  }, [device]);

  if (!isOpen || !selectedDeviceId) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 flex items-start justify-end bg-slate-950/60 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="sr-only"
        onClick={onClose}
      >
        Close
      </button>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Device drawer for ${selectedDeviceId}`}
        className="flex h-screen w-full max-w-3xl flex-col border-l border-indigo-400/30 bg-slate-900/95 p-6 shadow-2xl md:w-[66vw] lg:w-[50vw]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
              Device Drawer
            </p>
            <h2 className="text-2xl font-semibold text-white">{selectedDeviceId}</h2>
            <p className="text-sm text-white/70">
              {anonymized
                ? "Anonymized view active"
                : "Full metadata view · aligns with governance cues."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${governanceAccent}`}
            >
              {device?.governanceCue.severity ?? "—"} cue
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Metadata
            </p>
            <dl className="space-y-2 text-sm text-white/80">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-white/60">Assigned to</dt>
                <dd className="font-semibold text-white">{device?.assignedTo ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-white/60">Condition</dt>
                <dd className="font-semibold text-white">{device?.condition ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-white/60">Offboarding status</dt>
                <dd className="font-semibold text-white">{device?.offboardingStatus ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-white/60">Last transfer</dt>
                <dd className="font-semibold text-white">
                  {formatDateTime(device?.offboardingMetadata?.lastTransferAt ?? null)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-white/60">Notes</dt>
                <dd className="text-right text-white/80">
                  {device?.lastTransferNotes ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-white/60">
                <dt>Refreshed</dt>
                <dd>{formatDateTime(device?.updatedAt ?? null)}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Anonymization & Actions
            </p>
            <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-50">
              Anonymization {anonymized ? "enabled" : "disabled"} for this session. Chips mirror grid
              state and will update when presets change.
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                ref={exportButtonRef}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                onClick={() => void exportAuditSnapshot(selectedDeviceId)}
              >
                Export Audit Snapshot
              </button>
              <button
                type="button"
                ref={handoffButtonRef}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                onClick={() => void initiateHandoff(selectedDeviceId)}
              >
                Initiate Handoff
              </button>
            </div>
            <p className="text-xs text-white/60">
              CTA wiring and audit timeline will be completed in subsequent tasks.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Audit Timeline
            </p>
            <button
              ref={firstFocusableRef}
              type="button"
              className="rounded-md border border-white/20 px-2 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              onClick={() => {
                void refetch();
              }}
            >
              Refresh
            </button>
          </div>
          <AuditTimeline deviceId={selectedDeviceId} />
        </div>

        {isFetching && (
          <div className="mt-4 text-sm text-white/60">Refreshing device details…</div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
            {(error as Error).message}
          </div>
        )}
      </aside>
    </div>
  );
}
