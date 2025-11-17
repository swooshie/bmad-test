"use client";

import { useMemo, useState } from "react";

import { DEVICE_COLUMNS } from "../types";
import { usePerformanceMetrics } from "../hooks/usePerformanceMetrics";
import { useAnonymizationState } from "../state/anonymization-store";

type Props = {
  onClose: () => void;
};

const PRESETS = [
  { id: "demo-safe", label: "Demo-safe", description: "Mask sensitive columns for demos." },
  { id: "full-visibility", label: "Full visibility", description: "Show all columns with no masking." },
];

export const AnonymizationPresetsPanel = ({ onClose }: Props) => {
  const { enabled, presetId, overrides, savePreset } = useAnonymizationState();
  const { recordInteraction } = usePerformanceMetrics({ anonymized: enabled });
  const [localPreset, setLocalPreset] = useState<string>(presetId ?? "demo-safe");
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>(overrides ?? {});

  const handlePresetChange = async (id: string) => {
    setLocalPreset(id);
    recordInteraction("governance-preset-select", 0, 0, { presetId: id });
    await savePreset(id, localOverrides);
  };

  const toggleOverride = (columnId: string) => {
    setLocalOverrides((current) => {
      const next = { ...current, [columnId]: !current[columnId] };
      return next;
    });
  };

  const applyOverrides = async () => {
    recordInteraction("governance-preset-apply-overrides", 0, 0, { presetId: localPreset });
    await savePreset(localPreset, localOverrides);
    onClose();
  };

  const columnOptions = useMemo(
    () =>
      DEVICE_COLUMNS.map((column) => ({
        id: column.id,
        label: column.label,
      })),
    []
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="presets-heading"
      className="rounded-2xl border border-white/15 bg-slate-900/90 p-4 text-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Anonymization Presets
          </p>
          <h3 className="text-lg font-semibold" id="presets-heading">
            Choose a preset and column overrides
          </h3>
          <p className="text-sm text-white/80" id="presets-description">
            Presets persist per user and log each change for governance.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close presets panel"
          onClick={onClose}
          className="rounded-lg border border-white/30 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-white transition hover:border-white/60 hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {PRESETS.map((preset) => {
          const isActive = localPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(preset.id)}
              aria-pressed={isActive}
              aria-describedby="presets-description"
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-indigo-400 bg-indigo-500/20 shadow-inner"
                  : "border-white/15 bg-white/5 hover:border-white/30"
              }`}
            >
              <span className="text-sm font-semibold">{preset.label}</span>
              <span className="text-xs text-white/70">{preset.description}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
          Column overrides
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {columnOptions.map((column) => {
            const checked = localOverrides[column.id] ?? false;
            return (
              <label
                key={column.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <span>{column.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOverride(column.id)}
                  aria-pressed={checked}
                  aria-describedby="presets-description"
                  className="h-4 w-4 accent-indigo-500"
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={applyOverrides}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Save preset
        </button>
      </div>
    </div>
  );
};

export default AnonymizationPresetsPanel;
