'use client';

import { useCallback, useEffect, useMemo, useRef } from "react";

import { API_ROUTES } from "@/lib/routes";

type MetricContext = Record<string, string | number | boolean | null | undefined>;

type MetricPayload = {
  metric: string;
  value: number;
  threshold?: number;
  context?: MetricContext;
  timestamp?: string;
  requestId?: string;
  anonymized?: boolean;
};

type TransportPayload = {
  metrics: MetricPayload[];
  requestId?: string;
  anonymized?: boolean;
};

type UsePerformanceMetricsOptions = {
  anonymized?: boolean;
  requestId?: string;
  endpoint?: string;
  transport?: (payload: TransportPayload) => Promise<void>;
};

const DEFAULT_FLUSH_DELAY_MS = 400;
const FALLBACK_THRESHOLD_MS = 200;
const FCP_THRESHOLD_MS = 2000;

const createRequestId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now()}`;
  }
};

export const usePerformanceMetrics = ({
  anonymized = false,
  requestId,
  endpoint = API_ROUTES.metrics,
  transport,
}: UsePerformanceMetricsOptions = {}) => {
  const queueRef = useRef<MetricPayload[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef<string>(requestId ?? createRequestId());
  const anonymizedRef = useRef<boolean>(anonymized);

  useEffect(() => {
    anonymizedRef.current = anonymized;
  }, [anonymized]);

  const sendPayload = useMemo(
    () =>
      transport ??
      (async (payload: TransportPayload) => {
        const body = JSON.stringify(payload);
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const sent = navigator.sendBeacon(
            endpoint,
            new Blob([body], { type: "application/json" })
          );
          if (sent) return;
        }
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }),
    [endpoint, transport]
  );

  const flush = useCallback(async () => {
    if (!queueRef.current.length) {
      return;
    }
    const payload: TransportPayload = {
      metrics: [...queueRef.current],
      requestId: requestIdRef.current,
      anonymized: anonymizedRef.current,
    };
    queueRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    await sendPayload(payload);
  }, [sendPayload]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flush().catch(() => {
        /* swallow transport errors */
      });
    }, DEFAULT_FLUSH_DELAY_MS);
  }, [flush]);

  const recordMetric = useCallback(
    (metric: string, value: number, threshold?: number, context?: MetricContext) => {
      if (!Number.isFinite(value)) {
        return;
      }
      queueRef.current.push({
        metric,
        value,
        threshold,
        context,
        timestamp: new Date().toISOString(),
      });
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const recordInteraction = useCallback(
    (metric: string, durationMs: number, threshold = FALLBACK_THRESHOLD_MS, context?: MetricContext) =>
      recordMetric(metric, durationMs, threshold, context),
    [recordMetric]
  );

  const startInteraction = useCallback(
    (metric: string, threshold = FALLBACK_THRESHOLD_MS, context?: MetricContext) => {
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      return () => {
        const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        recordMetric(metric, endedAt - startedAt, threshold, context);
      };
    },
    [recordMetric]
  );

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") {
      const entry = performance.getEntriesByName("first-contentful-paint")[0];
      if (entry) {
        recordMetric("FCP", entry.startTime, FCP_THRESHOLD_MS, { source: "performance-timing" });
      }
      return;
    }

    if (!PerformanceObserver.supportedEntryTypes?.includes("paint")) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const paints = list.getEntriesByName("first-contentful-paint");
      const entry = paints[paints.length - 1];
      if (entry) {
        recordMetric("FCP", entry.startTime, FCP_THRESHOLD_MS, { source: "performance-observer" });
      }
    });

    observer.observe({ type: "paint", buffered: true });
    return () => observer.disconnect();
  }, [recordMetric]);

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") {
      return;
    }
    if (!PerformanceObserver.supportedEntryTypes?.includes("event")) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (!entries.length) return;
      const worst = entries.reduce((prev, current) =>
        (current as PerformanceEventTiming).duration > (prev as PerformanceEventTiming).duration
          ? current
          : prev
      ) as PerformanceEventTiming;
      if (worst?.duration) {
        recordMetric("INP", worst.duration, FALLBACK_THRESHOLD_MS, {
          interactionId: (worst as PerformanceEventTiming).interactionId ?? undefined,
          name: worst.name,
        });
      }
    });

    observer.observe({ type: "event", buffered: true, durationThreshold: 16 });
    return () => observer.disconnect();
  }, [recordMetric]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (queueRef.current.length) {
        flush().catch(() => {
          /* swallow transport errors on unmount */
        });
      }
    };
  }, [flush]);

  return {
    recordInteraction,
    startInteraction,
    flush,
  };
};
