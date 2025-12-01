/**
 * @vitest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SyncStatusBanner from "@/app/(manager)/components/SyncStatusBanner";

const manualFetchSpy = vi.fn();
const mockUseSyncStatus = vi.fn();

vi.mock("@/lib/use-sync-status", () => ({
  useSyncStatus: () => mockUseSyncStatus(),
}));

vi.mock("@/app/(manager)/devices/hooks/usePerformanceMetrics", () => ({
  usePerformanceMetrics: () => ({
    startInteraction: () => () => undefined,
    recordInteraction: vi.fn(),
  }),
}));

vi.mock("@/app/(manager)/components/manager-session-context", () => ({
  useManagerSession: () => ({ email: "manager@example.com" }),
}));

vi.mock("@/app/(manager)/devices/state/anonymization-store", () => ({
  useAnonymizationState: () => ({ enabled: false, isPending: false, error: null }),
}));

global.fetch = manualFetchSpy as unknown as typeof fetch;

describe("SyncStatusBanner error handling", () => {
  beforeEach(() => {
    mockUseSyncStatus.mockReturnValue({
      status: {
        state: "error",
        runId: "run-1",
        completedAt: new Date().toISOString(),
        requestedBy: "scheduler",
        trigger: "scheduled",
        errorCode: "SHEETS_AUTH_REVOKED",
        message: "Sheets service account lost access",
        recommendation: "Rotate the Sheets service credential",
        referenceId: "ref-123",
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("announces error with alert focus and retry CTA", async () => {
    manualFetchSpy.mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<SyncStatusBanner />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sync failed · Code SHEETS_AUTH_REVOKED");
    expect(alert).toHaveTextContent("Rotate the Sheets service credential");

    await waitFor(() => expect(alert).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: /Retry sync/i }));
    await waitFor(() =>
      expect(manualFetchSpy).toHaveBeenCalledWith("/api/sync/manual", { method: "POST" })
    );
  });

  it("surfaces warning messages when provided", async () => {
    mockUseSyncStatus.mockReturnValue({
      status: {
        state: "success",
        runId: "run-9",
        completedAt: new Date().toISOString(),
        requestedBy: "lead@nyu.edu",
        trigger: "manual",
        metrics: {
          added: 1,
          updated: 0,
          unchanged: 0,
          rowsProcessed: 1,
          rowsSkipped: 0,
          conflicts: 0,
          durationMs: 310000,
          serialConflicts: 0,
          legacyIdsUpdated: 0,
        },
        warning: { type: "duration", message: "Run exceeded 5 minutes" },
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<SyncStatusBanner />);

    expect(await screen.findByText(/Run exceeded 5 minutes/)).toBeInTheDocument();
  });
});
