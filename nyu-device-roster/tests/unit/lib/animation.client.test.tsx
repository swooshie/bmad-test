/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";

import { animationTokens, useAnimationTokens } from "@/lib/animation";

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

describe("animation tokens", () => {
  it("exposes deterministic timing values", () => {
    expect(animationTokens.hoverMs).toBe(120);
    expect(animationTokens.pressMs).toBe(90);
    expect(animationTokens.releaseMs).toBe(150);
  });

  it("honors prefers-reduced-motion flag", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useAnimationTokens());
    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.hoverDurationMs).toBe(0);
    expect(result.current.pressDurationMs).toBe(0);
    expect(result.current.releaseDurationMs).toBe(0);
  });
});
