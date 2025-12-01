/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditPanel } from "@/app/(manager)/dashboard/components/AuditPanel";

vi.mock("@/app/(manager)/devices/hooks/usePerformanceMetrics", () => ({
  usePerformanceMetrics: () => ({
    recordInteraction: vi.fn(),
  }),
}));

const buildResponse = (events: Array<Record<string, unknown>>) => ({
  ok: true,
  json: async () => ({ data: { events } }),
});

const renderWithQueryClient = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuditPanel />
    </QueryClientProvider>
  );
};

describe("AuditPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(
      buildResponse([
        {
          id: "1",
          eventType: "sync",
          action: "SYNC_RUN",
          status: "success",
          actor: "lead@nyu.edu",
          timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
        },
      ])
    ) as unknown as typeof fetch;
  });

  it("renders audit events and toggles filters", async () => {
    renderWithQueryClient();

    await waitFor(() => {
      expect(screen.getByText("SYNC_RUN")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalled();
    const firstCallUrl = (global.fetch as vi.Mock).mock.calls[0][0] as string;
    expect(firstCallUrl).toContain("eventType=sync");
    expect(firstCallUrl).toContain("eventType=anonymization");
    expect(firstCallUrl).toContain("eventType=allowlist-change");

    (global.fetch as vi.Mock).mockResolvedValueOnce(buildResponse([]));
    const allowlistButton = screen.getByRole("button", { name: /Allowlist/i });
    fireEvent.click(allowlistButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    const secondUrl = (global.fetch as vi.Mock).mock.calls[1][0] as string;
    expect(secondUrl).not.toContain("allowlist-change");
  });
});
