import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUseAnonymizationState = vi.fn();
const mockRecordInteraction = vi.fn();

vi.mock("@/app/(manager)/devices/state/anonymization-store", () => ({
  useAnonymizationState: () => mockUseAnonymizationState(),
}));

vi.mock("@/app/(manager)/devices/hooks/usePerformanceMetrics", () => ({
  usePerformanceMetrics: () => ({
    recordInteraction: mockRecordInteraction,
  }),
}));

import GovernanceBanner from "@/app/(manager)/devices/components/GovernanceBanner";
import AnonymizationPresetsPanel from "@/app/(manager)/devices/components/AnonymizationPresetsPanel";

describe("GovernanceBanner", () => {
  beforeEach(() => {
    mockUseAnonymizationState.mockReturnValue({
      enabled: true,
      lastToggleAt: "2025-11-01T12:00:00.000Z",
    });
    mockRecordInteraction.mockClear();
  });

  it("renders anonymization state and last toggle timestamp", () => {
    const markup = ReactDOMServer.renderToStaticMarkup(
      <GovernanceBanner onOpenPresets={vi.fn()} />
    );

    expect(markup).toContain("Anonymization enabled");
    expect(markup).toContain("Last toggle");
  });
});

describe("AnonymizationPresetsPanel", () => {
  beforeEach(() => {
    mockUseAnonymizationState.mockReturnValue({
      enabled: true,
      presetId: "demo-safe",
      overrides: {},
      savePreset: vi.fn().mockResolvedValue(undefined),
    });
    mockRecordInteraction.mockClear();
  });

  it("renders preset names", () => {
    const markup = ReactDOMServer.renderToStaticMarkup(
      <AnonymizationPresetsPanel onClose={vi.fn()} />
    );

    expect(markup).toContain("Demo-safe");
    expect(markup).toContain("Full visibility");
  });
});
