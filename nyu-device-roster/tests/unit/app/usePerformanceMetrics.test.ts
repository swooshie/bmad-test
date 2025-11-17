import { renderHook, act } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { usePerformanceMetrics } from "@/app/(manager)/devices/hooks/usePerformanceMetrics";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });

vi.stubGlobal("window", dom.window);
vi.stubGlobal("document", dom.window.document);
vi.stubGlobal("navigator", dom.window.navigator);
vi.stubGlobal("performance", dom.window.performance);

if (!globalThis.crypto?.randomUUID) {
  vi.stubGlobal("crypto", {
    ...globalThis.crypto,
    randomUUID: () => "req-test",
  });
}

describe("usePerformanceMetrics", () => {
  const transport = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    transport.mockClear();
  });

  it("flushes interaction metrics with anonymization and requestId", async () => {
    const { result } = renderHook(() =>
      usePerformanceMetrics({ anonymized: true, requestId: "req-test", transport })
    );

    act(() => {
      result.current.recordInteraction("grid-sort", 120, 180, { columnId: "status" });
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-test",
        anonymized: true,
        metrics: expect.arrayContaining([
          expect.objectContaining({
            metric: "grid-sort",
            value: 120,
            threshold: 180,
            context: expect.objectContaining({ columnId: "status" }),
          }),
        ]),
      })
    );
  });

  it("records FCP from performance entries when PerformanceObserver is unavailable", async () => {
    const originalObserver = globalThis.PerformanceObserver;
    // @ts-expect-error - override for test
    globalThis.PerformanceObserver = undefined;
    const originalGetEntriesByName = performance.getEntriesByName;
    performance.getEntriesByName = vi
      .fn()
      .mockReturnValue([{ name: "first-contentful-paint", startTime: 1234 }]);

    const { result } = renderHook(() => usePerformanceMetrics({ transport }));

    await act(async () => {
      await result.current.flush();
    });

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({ metric: "FCP", value: 1234 }),
        ]),
      })
    );

    performance.getEntriesByName = originalGetEntriesByName;
    if (originalObserver) {
      globalThis.PerformanceObserver = originalObserver;
    } else {
      // @ts-expect-error - cleanup
      delete globalThis.PerformanceObserver;
    }
  });
});
