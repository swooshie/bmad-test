"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const status = await fetchStatus();
        if (isMounted) {
          setState(status);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown status error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    timer = setInterval(load, pollIntervalMs);

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [pollIntervalMs]);

  return { status: state, isLoading, error };
};
