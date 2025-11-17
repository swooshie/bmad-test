/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import IconActionButton from "@/app/(manager)/components/IconActionButton";
import { API_ROUTES } from "@/lib/routes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/(manager)/devices/state/anonymization-store", () => ({
  useAnonymizationState: () => ({
    enabled: false,
    isPending: false,
    error: null,
    toggle: vi.fn(),
    savePreset: vi.fn(),
  }),
}));

vi.mock("@/app/(manager)/devices/hooks/usePerformanceMetrics", () => ({
  usePerformanceMetrics: () => ({
    startInteraction: () => () => {},
    recordInteraction: vi.fn(),
    flush: vi.fn(),
  }),
}));

const stubMatchMedia = (matches: boolean) => {
  const target = typeof window === "undefined" ? globalThis : window;
  Object.defineProperty(target, "matchMedia", {
    writable: true,
    value: () => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
};

describe("IconActionButton", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    // @ts-expect-error - simplify fetch mocking
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    );
  });

  it("keeps labels visible when reduced motion is preferred", () => {
    stubMatchMedia(true);
    render(
      <IconActionButton
        icon={<span>*</span>}
        label="Refresh"
        actionId="refresh"
      />
    );

    const button = screen.getByRole("button", { name: /refresh/i });
    expect(button).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByText("Refresh")).toBeVisible();
  });

  it("sends telemetry payload on press", async () => {
    render(
      <IconActionButton
        icon={<span>*</span>}
        label="Export"
        actionId="export"
        onPress={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      const calls = (global.fetch as unknown as vi.Mock).mock.calls;
      expect(calls.some(([url]) => url === API_ROUTES.iconActionAudit)).toBe(true);
    });
  });
});
