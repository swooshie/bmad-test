"use client";

import { useMemo } from "react";

import { useAnonymizationState } from "../state/anonymization-store";

type Props = {
  announce: (message: string) => void;
};

export const AnonymizationToggle = ({ announce }: Props) => {
  const { enabled, isPending, error, toggle } = useAnonymizationState();

  const label = useMemo(
    () => (enabled ? "Anonymization on" : "Anonymization off"),
    [enabled]
  );

  const handleToggle = async () => {
    const next = !enabled;
    announce(next ? "Anonymization enabled" : "Anonymization disabled");
    await toggle(next);
  };

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-200">
            Data Privacy
          </span>
          <span className="text-white">{label}</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          aria-pressed={enabled}
          aria-describedby="anonymization-help"
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            enabled
              ? "bg-indigo-500 text-white hover:bg-indigo-400"
              : "bg-white text-slate-900 hover:bg-slate-100"
          } disabled:opacity-60`}
        >
          {enabled ? "Disable" : "Enable"}
          {isPending ? "…" : null}
        </button>
      </div>
      <p id="anonymization-help" className="text-xs text-white/70">
        Masks sensitive fields with deterministic placeholders; audit events capture each toggle.
      </p>
      {error ? (
        <p className="text-xs text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default AnonymizationToggle;
