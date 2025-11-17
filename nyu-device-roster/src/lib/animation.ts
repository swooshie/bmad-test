import { useEffect, useMemo, useState } from "react";

export type AnimationTokens = {
  hoverMs: number;
  pressMs: number;
  releaseMs: number;
  easing: string;
  exitEasing: string;
};

export const animationTokens: AnimationTokens = {
  hoverMs: 120,
  pressMs: 90,
  releaseMs: 150,
  easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  exitEasing: "cubic-bezier(0.4, 0, 0.2, 1)",
};

const prefersReducedMotion = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
};

export const useAnimationTokens = () => {
  const reducedMotion = useReducedMotion();

  return useMemo(
    () => ({
      ...animationTokens,
      reducedMotion,
      hoverDurationMs: reducedMotion ? 0 : animationTokens.hoverMs,
      pressDurationMs: reducedMotion ? 0 : animationTokens.pressMs,
      releaseDurationMs: reducedMotion ? 0 : animationTokens.releaseMs,
    }),
    [reducedMotion]
  );
};

export const animationStyleProps = (reducedMotion: boolean) =>
  reducedMotion
    ? {
        transition: "none",
      }
    : {
        transitionTimingFunction: animationTokens.easing,
      };
