"use client";

import { useState } from "react";

import AnonymizationPresetsPanel from "../devices/components/AnonymizationPresetsPanel";
import GovernanceBanner from "../devices/components/GovernanceBanner";

export const GovernanceBannerRegion = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <GovernanceBanner onOpenPresets={() => setOpen(true)} />
      {open ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
          <AnonymizationPresetsPanel onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
};

export default GovernanceBannerRegion;
