'use client';

import { useState } from "react";

import type { DeviceGridQueryFilters } from "@/lib/devices/grid-query";
import { API_ROUTES } from "@/lib/routes";

type ExportControlsProps = {
  filters: DeviceGridQueryFilters;
  announce: (message: string) => void;
};

const parseFilename = (headerValue: string | null, fallback: string) => {
  if (!headerValue) return fallback;
  const match = /filename=\"?([^\";]+)\"?/i.exec(headerValue);
  return match?.[1] ?? fallback;
};

export const ExportControls = ({ filters, announce }: ExportControlsProps) => {
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch(API_ROUTES.deviceExport, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, format, onlyFlagged }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Unable to export devices right now.");
      }

      const blob = await response.blob();
      const fileName = parseFilename(
        response.headers.get("content-disposition"),
        `devices-governance.${format}`
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      announce(`Downloaded governance export (${format.toUpperCase()})`);
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Unable to export devices.";
      setError(message);
      announce("Device export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">
            Export Governance Snapshot
          </p>
          <p className="text-xs text-white/70">
            CSV/PDF downloads include badges, statuses, and transfer notes for audit trails.
          </p>
        </div>
        <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-format"
              value="csv"
              checked={format === "csv"}
              onChange={() => setFormat("csv")}
              className="h-4 w-4 accent-indigo-400"
            />
            CSV
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-format"
              value="pdf"
              checked={format === "pdf"}
              onChange={() => setFormat("pdf")}
              className="h-4 w-4 accent-indigo-400"
            />
            PDF
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={onlyFlagged}
            onChange={(event) => setOnlyFlagged(event.target.checked)}
            className="h-4 w-4 rounded border-white/30 bg-transparent text-indigo-400 focus:ring-indigo-400"
          />
          Export flagged devices only
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="rounded-full border border-indigo-300/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-100 transition hover:border-indigo-200 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
        >
          {isExporting ? "Exporting…" : "Download with cues"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
    </section>
  );
};

export default ExportControls;
