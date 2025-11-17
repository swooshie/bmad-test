import type { Metadata } from "next";

import DeviceGridShell from "./components/DeviceGridShell";

export const metadata: Metadata = {
  title: "NYU Device Roster · Devices",
  description:
    "Spreadsheet-grade grid with virtualization, accessible controls, and Mongo-backed pagination.",
};

export default function DevicesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Epic C3 · Governance cues
        </p>
        <h1 className="text-3xl font-semibold text-white">Devices</h1>
        <p className="text-white/70">
          Interrogate the roster with instant filters, governance badges, and audit-ready exports
          while staying within the 200&nbsp;ms response budget.
        </p>
      </header>

      <DeviceGridShell />
    </div>
  );
}
