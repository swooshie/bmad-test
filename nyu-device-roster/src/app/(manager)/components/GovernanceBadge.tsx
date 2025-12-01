'use client';

import GovernanceBadgeTooltip from "./GovernanceBadgeTooltip";
import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";
import { hasGovernanceRisk } from "@/lib/governance/cues";

const SEVERITY_STYLES = {
  attention: {
    border: "border-amber-300/50",
    dot: "bg-amber-300",
    text: "text-amber-100",
  },
  critical: {
    border: "border-rose-400/60",
    dot: "bg-rose-400",
    text: "text-rose-100",
  },
} as const;

type GovernanceBadgeProps = {
  serial: string;
  cue: DeviceGridDevice["governanceCue"];
};

export const GovernanceBadge = ({ serial, cue }: GovernanceBadgeProps) => {
  if (!hasGovernanceRisk(cue) || cue.severity === "none") {
    return null;
  }

  const severity = cue.severity === "critical" ? "critical" : "attention";
  const styles = SEVERITY_STYLES[severity];

  const badgeContent = (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${styles.text}`}>
      <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true" />
      <span>{cue.summary}</span>
    </span>
  );

  return <GovernanceBadgeTooltip serial={serial} cueSummary={cue.summary} badge={badgeContent} />;
};

export default GovernanceBadge;
