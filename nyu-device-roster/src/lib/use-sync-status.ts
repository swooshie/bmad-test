"use client";

import { useCallback, useEffect, useState } from "react";

import type { SyncStatusState } from "@/lib/sync-status";

type UseSyncStatusOptions = {
  pollIntervalMs?: number;
};

const fetchStatus = async (): Promise<SyncStatusState> => {
  const response = await fetch("/api/sync/status");
  if (!response.ok) {
    throw new Error(`Failed to load sync status: ${response.status}`);
  }
  const payload = (await response.json()) as { data: SyncStatusState };
  return payload.data;
};

export const useSyncStatus = (options?: UseSyncStatusOptions) => {
  const pollIntervalMs = Math.max(2000, options?.pollIntervalMs ?? 5000);
  const [state, setState] = useState<SyncStatusState>({ state: "idle" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await fetchStatus();
      setState(status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown status error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadWithLifecycle = async () => {
      const startedAt = performance.now();
      await load();
      const duration = performance.now() - startedAt;
      if (isMounted && duration > pollIntervalMs * 2) {
        // If fetching is unusually slow, ensure interval still advances
        setIsLoading(false);
      }
    };

    void loadWithLifecycle();
    timer = setInterval(loadWithLifecycle, pollIntervalMs);

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [load, pollIntervalMs]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { status: state, isLoading, error, refresh };
};
