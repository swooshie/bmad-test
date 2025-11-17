import React from "react";
import { describe, expect, it } from "vitest";
import ReactDOMServer from "react-dom/server";

import { GovernanceBadge } from "@/app/(manager)/components/GovernanceBadge";
import type { GovernanceCue } from "@/lib/governance/cues";

const buildCue = (overrides: Partial<GovernanceCue> = {}): GovernanceCue => ({
  severity: "attention",
  reasons: ["offboarding"],
  summary: "Offboarding: Requested",
  flags: {
    offboardingStatus: "Requested",
    condition: "Operational",
  },
  ...overrides,
});

describe("GovernanceBadge", () => {
  it("renders a badge when governance risk is present", () => {
    const markup = ReactDOMServer.renderToStaticMarkup(
      <GovernanceBadge deviceId="alpha-1" cue={buildCue()} />
    );

    expect(markup).toContain("Offboarding: Requested");
  });

  it("renders nothing when severity is none", () => {
    const markup = ReactDOMServer.renderToStaticMarkup(
      <GovernanceBadge deviceId="alpha-2" cue={buildCue({ severity: "none", reasons: [], summary: "Governance clear" })} />
    );

    expect(markup).toBe("");
  });
});
