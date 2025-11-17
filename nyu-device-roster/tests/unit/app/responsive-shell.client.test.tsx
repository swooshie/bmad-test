/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";

import { ResponsiveShell } from "@/app/(manager)/components/ResponsiveShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/(manager)/components/GovernanceBannerRegion", () => ({
  __esModule: true,
  default: () => <div data-testid="governance-banner">Governance</div>,
}));

vi.mock("@/components/SyncStatusBanner", () => ({
  __esModule: true,
  default: () => <div data-testid="sync-status">Sync status</div>,
}));

vi.mock("@/app/(manager)/devices/hooks/usePerformanceMetrics", () => ({
  usePerformanceMetrics: () => ({
    startInteraction: () => () => {},
    recordInteraction: vi.fn(),
    flush: vi.fn(),
  }),
}));

describe("ResponsiveShell", () => {
  it("renders bottom dock controls and opens audit slide-over with focus return", () => {
    render(
      <ResponsiveShell userEmail="demo@nyu.edu" userName="Demo" >
        <div>Content</div>
      </ResponsiveShell>
    );

    const auditButton = screen.getByRole("button", { name: /audit/i });
    fireEvent.click(auditButton);
    const dialog = screen.getByRole("dialog", { name: /audit and governance/i });
    expect(dialog).toBeInTheDocument();

    const close = screen.getByRole("button", { name: /close/i });
    fireEvent.click(close);
    expect(auditButton).toHaveFocus();
  });
});
