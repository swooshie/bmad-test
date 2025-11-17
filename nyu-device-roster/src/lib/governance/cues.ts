export type GovernanceSeverity = "none" | "attention" | "critical";

export type GovernanceReason = "offboarding" | "condition";

export type GovernanceCue = {
  severity: GovernanceSeverity;
  reasons: GovernanceReason[];
  summary: string;
  flags: {
    offboardingStatus: string | null;
    condition: string;
  };
};

const CONDITION_ALERT_STATES = new Set(["Poor", "Needs Repair"]);
const CRITICAL_OFFBOARDING_PATTERNS = [/hold/i, /security/i, /decom/i, /retire/i];

const hasCriticalOffboardingKeyword = (value: string) =>
  CRITICAL_OFFBOARDING_PATTERNS.some((pattern) => pattern.test(value));

const buildSummary = (reasons: GovernanceReason[], flags: { offboardingStatus: string | null; condition: string }) => {
  if (!reasons.length) {
    return "Governance clear";
  }
  const parts: string[] = [];
  if (reasons.includes("offboarding") && flags.offboardingStatus) {
    parts.push(`Offboarding: ${flags.offboardingStatus}`);
  }
  if (reasons.includes("condition")) {
    parts.push(`Condition: ${flags.condition}`);
  }
  return parts.join(" · ");
};

export const deriveGovernanceCue = (input: { offboardingStatus?: string | null; condition: string }): GovernanceCue => {
  const flags = {
    offboardingStatus: input.offboardingStatus?.trim().length ? input.offboardingStatus : null,
    condition: input.condition,
  };

  const reasons: GovernanceReason[] = [];
  if (flags.offboardingStatus) {
    reasons.push("offboarding");
  }
  if (CONDITION_ALERT_STATES.has(flags.condition)) {
    reasons.push("condition");
  }

  let severity: GovernanceSeverity = "none";
  if (reasons.length) {
    severity =
      CONDITION_ALERT_STATES.has(flags.condition) ||
      (flags.offboardingStatus && hasCriticalOffboardingKeyword(flags.offboardingStatus))
        ? "critical"
        : "attention";
  }

  return {
    severity,
    reasons,
    summary: buildSummary(reasons, flags),
    flags,
  };
};

export const hasGovernanceRisk = (cue: GovernanceCue) => cue.reasons.length > 0;

export const RISKY_CONDITIONS = Array.from(CONDITION_ALERT_STATES);
