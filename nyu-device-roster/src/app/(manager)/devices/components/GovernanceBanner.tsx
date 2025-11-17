"use client";

import { useMemo } from "react";

import { usePerformanceMetrics } from "../hooks/usePerformanceMetrics";
import { useAnonymizationState } from "../state/anonymization-store";

type Props = {
  onOpenPresets: () => void;
};

const formatTimestamp = (value: string | null) => {
  if (!value) return "Not set";
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
};

export const GovernanceBanner = ({ onOpenPresets }: Props) => {
  const { enabled, lastToggleAt } = useAnonymizationState();
  const { recordInteraction } = usePerformanceMetrics({ anonymized: enabled });

  const statusText = useMemo(
    () => (enabled ? "Anonymization enabled (demo-safe)" : "Full visibility"),
    [enabled]
  );

  const handleOpen = () => {
    recordInteraction("governance-banner-open", 0, 0, { anonymized: enabled });
    onOpenPresets();
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Governance Reminder
          </p>
          <p className="text-base font-semibold text-white">{statusText}</p>
          <p className="text-xs text-indigo-100">
            Last toggle: <span aria-live="polite">{formatTimestamp(lastToggleAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpen}
            aria-label="Open anonymization presets"
            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
          >
            Manage presets
          </button>
        </div>
      </div>
      <p className="text-xs text-indigo-100" id="governance-banner-description">
        Toggle between demo-safe and full visibility presets. Changes are logged for governance and
        tied to anonymization state.
      </p>
    </div>
  );
};

export default GovernanceBanner;
