'use client';

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAnimationTokens } from "@/lib/animation";
import { API_ROUTES } from "@/lib/routes";
import { usePerformanceMetrics } from "@/app/(manager)/devices/hooks/usePerformanceMetrics";
import { useAnonymizationState } from "@/app/(manager)/devices/state/anonymization-store";

type IconActionButtonProps = {
  icon: React.ReactNode;
  label: string;
  actionId: "refresh" | "export" | "filter" | "governance" | "search" | "audit";
  tooltip?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  targetHref?: string;
  onPress?: () => Promise<void> | void;
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
};

const postTelemetry = async ({
  actionId,
  durationMs,
  anonymized,
  reducedMotion,
}: {
  actionId: string;
  durationMs: number;
  anonymized: boolean;
  reducedMotion: boolean;
}) => {
  try {
    await fetch(API_ROUTES.iconActionAudit, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionId,
        durationMs,
        anonymized,
        reducedMotion,
        triggeredAt: new Date().toISOString(),
      }),
    });
  } catch {
    /* ignore audit transport failures for UX */
  }
};

export const IconActionButton = ({
  icon,
  label,
  actionId,
  tooltip,
  ariaPressed,
  ariaExpanded,
  targetHref,
  disabled = false,
  onPress,
  buttonRef,
}: IconActionButtonProps) => {
  const { reducedMotion, hoverDurationMs, pressDurationMs, releaseDurationMs } = useAnimationTokens();
  const { startInteraction, recordInteraction } = usePerformanceMetrics();
  const { enabled: anonymized } = useAnonymizationState();
  const [isActive, setIsActive] = useState(false);
  const router = useRouter();
  const interactionRef = useRef<(() => void) | null>(null);

  const mergedAriaLabel = useMemo(() => label, [label]);

  const handlePointerDown = () => {
    if (disabled) return;
    setIsActive(true);
    interactionRef.current = startInteraction("icon-action-press", 200, {
      actionId,
      reducedMotion,
    });
  };

  const handlePointerUp = () => {
    setIsActive(false);
    if (interactionRef.current) {
      interactionRef.current();
      interactionRef.current = null;
    }
    recordInteraction("icon-action-release", releaseDurationMs, 200, {
      actionId,
      reducedMotion,
    });
  };

  const navigateIfNeeded = useCallback(() => {
    if (targetHref) {
      router.push(targetHref);
    }
  }, [router, targetHref]);

  const handleClick = async () => {
    if (disabled) return;
    const startedAt = performance.now();
    const endInteraction = startInteraction("icon-action-trigger", 200, { actionId });

    try {
      if (onPress) {
        await onPress();
      }
      navigateIfNeeded();
    } finally {
      const durationMs = Math.max(performance.now() - startedAt, 0);
      recordInteraction("icon-action-trigger", durationMs, 200, {
        actionId,
        reducedMotion,
      });
      endInteraction();
      postTelemetry({
        actionId,
        durationMs,
        anonymized: anonymized ?? false,
        reducedMotion,
      });
    }
  };

  return (
    <button
      type="button"
      className="icon-action text-sm font-semibold uppercase tracking-[0.2em]"
      aria-label={mergedAriaLabel}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      data-reduced-motion={reducedMotion}
      data-expanded={isActive}
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onBlur={handlePointerUp}
      onClick={handleClick}
      disabled={disabled}
      title={tooltip}
    >
      <span aria-hidden="true" className="text-lg">
        {icon}
      </span>
      <span className="icon-action__label">{label}</span>
      <span className="sr-only">
        {reducedMotion
          ? `${label} (labels pinned for reduced motion)`
          : `${label} (label reveals on hover or focus)`}
      </span>
      <style>{`
        button.icon-action {
          transition-duration: ${hoverDurationMs}ms;
        }
        button.icon-action:active {
          transition-duration: ${pressDurationMs}ms;
        }
      `}</style>
    </button>
  );
};

export default IconActionButton;
