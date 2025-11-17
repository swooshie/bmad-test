// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DeviceDrawer } from "@/app/(manager)/devices/components/DeviceDrawer";
import {
  __resetDeviceSelection,
  closeDeviceDrawer,
  openDeviceDrawer,
} from "@/app/(manager)/devices/state/device-selection-store";

const wrapper = (client: QueryClient, children: React.ReactNode) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("DeviceDrawer", () => {
  beforeEach(() => {
    __resetDeviceSelection();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const deviceId = url.includes("demo-002") ? "demo-002" : "demo-001";
      if (url.includes("/api/audit")) {
        return new Response(
          JSON.stringify({
            data: { events: [] },
            error: null,
          }),
          { status: 200 }
        );
      }
      const device =
        deviceId === "demo-002"
          ? {
              deviceId: "demo-002",
              assignedTo: "Jamie",
              condition: "Ready",
              offboardingStatus: null,
              governanceCue: { severity: "none", reasons: [], summary: "Clear", flags: {} },
              lastTransferNotes: null,
              offboardingMetadata: undefined,
              updatedAt: new Date().toISOString(),
            }
          : {
              deviceId: "demo-001",
              assignedTo: "Alex",
              condition: "Operational",
              offboardingStatus: "Requested",
              governanceCue: {
                severity: "attention",
                reasons: ["offboarding"],
                summary: "Offboarding: Requested",
                flags: { offboardingStatus: "Requested", condition: "Operational" },
              },
              lastTransferNotes: null,
              offboardingMetadata: { lastTransferAt: null },
              updatedAt: new Date().toISOString(),
            };

      return new Response(
        JSON.stringify({
          data: { device },
          error: null,
        }),
        { status: 200 }
      );
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    closeDeviceDrawer();
  });

  it("renders cached device metadata immediately on open", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["device-detail", "demo-001"], {
      deviceId: "demo-001",
      assignedTo: "Alex",
      condition: "Operational",
      offboardingStatus: "Requested",
      governanceCue: {
        severity: "attention",
        reasons: ["offboarding"],
        summary: "Offboarding: Requested",
        flags: { offboardingStatus: "Requested", condition: "Operational" },
      },
      lastTransferNotes: null,
      offboardingMetadata: { lastTransferAt: null },
      updatedAt: new Date("2025-01-05T14:00:00Z").toISOString(),
    });

    await act(async () => {
      openDeviceDrawer("demo-001");
      render(wrapper(queryClient, <DeviceDrawer onClose={vi.fn()} />));
    });

    expect(await screen.findByRole("dialog")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("demo-001")
    );
    expect(screen.getByText("demo-001")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["device-detail", "demo-002"], {
      deviceId: "demo-002",
      assignedTo: "Jamie",
      condition: "Ready",
      offboardingStatus: null,
      governanceCue: {
        severity: "none",
        reasons: [],
        summary: "Clear",
        flags: {},
      },
      lastTransferNotes: null,
      offboardingMetadata: undefined,
      updatedAt: new Date().toISOString(),
    });
    const onClose = vi.fn();
    await act(async () => {
      openDeviceDrawer("demo-002");
      render(wrapper(queryClient, <DeviceDrawer onClose={onClose} />));
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
