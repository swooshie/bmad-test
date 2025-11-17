"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { API_ROUTES } from "@/lib/routes";

type StoreState = {
  enabled: boolean;
  isPending: boolean;
  error: string | null;
  lastToggleAt: string | null;
  presetId: string | null;
  overrides: Record<string, boolean>;
};

type Listener = () => void;

const COOKIE_KEY = "nyu-device-roster-anonymized";
const PRESET_COOKIE_KEY = "nyu-device-roster-preset";

const listeners = new Set<Listener>();
let state: StoreState = {
  enabled: false,
  isPending: false,
  error: null,
  lastToggleAt: null,
  presetId: null,
  overrides: {},
};
let hydrated = false;

const readClientCookie = () => {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((entry) => {
    const [key, value] = entry.trim().split("=");
    if (key !== COOKIE_KEY) return false;
    return value === "1" || value === "true";
  });
};

const setState = (partial: Partial<StoreState>) => {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

export const useAnonymizationState = () => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    setState({
      enabled: readClientCookie(),
      presetId: readPresetCookie()?.presetId ?? null,
      overrides: readPresetCookie()?.overrides ?? {},
    });
    void loadPresetState();
  }, []);

  const toggle = useCallback(async (next: boolean) => {
    const previous = state.enabled;
    setState({ isPending: true, error: null, enabled: next }); // optimistic for <200ms UX

    try {
      const response = await fetch(API_ROUTES.deviceAnonymize, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Failed to update anonymization state");
      }

      const payload = (await response.json()) as { data?: { enabled: boolean; updatedAt?: string } };
      if (payload?.data?.enabled !== undefined) {
        setState({ enabled: payload.data.enabled, lastToggleAt: payload.data.updatedAt ?? null });
      }
    } catch (err) {
      setState({
        error: err instanceof Error ? err.message : "Unable to toggle anonymization",
        enabled: previous,
      });
    } finally {
      setState({ isPending: false });
    }
  }, []);

  const savePreset = useCallback(
    async (presetId: string, overrides: Record<string, boolean> = {}) => {
      setState({ isPending: true, error: null });
      try {
        const response = await fetch(API_ROUTES.devicePresets, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presetId, overrides }),
        });
        const payload = (await response.json()) as {
          data?: { presetId: string; overrides?: Record<string, boolean>; updatedAt?: string };
          error?: { message?: string };
        };
        if (!response.ok || payload.error) {
          throw new Error(payload.error?.message ?? "Failed to save preset");
        }
        setState({
          presetId: payload.data?.presetId ?? presetId,
          overrides: payload.data?.overrides ?? overrides,
          lastToggleAt: payload.data?.updatedAt ?? state.lastToggleAt,
        });
      } catch (err) {
        setState({
          error: err instanceof Error ? err.message : "Unable to save preset",
        });
      } finally {
        setState({ isPending: false });
      }
    },
    []
  );

  return { ...snapshot, toggle, savePreset };
};

export const __resetForTests = () => {
  hydrated = false;
  state = { enabled: false, isPending: false, error: null, lastToggleAt: null, presetId: null, overrides: {} };
  listeners.forEach((fn) => fn());
};

export type AnonymizationState = ReturnType<typeof useAnonymizationState>;

const readPresetCookie = (): { presetId: string | null; overrides: Record<string, boolean> } | null => {
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split(";")
    .map((entry) => entry.trim().split("="))
    .find(([key]) => key === PRESET_COOKIE_KEY)?.[1];
  if (!value) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(value)) as { presetId?: string; overrides?: Record<string, boolean> };
    return { presetId: decoded.presetId ?? null, overrides: decoded.overrides ?? {} };
  } catch {
    return null;
  }
};

const loadPresetState = async () => {
  try {
    const response = await fetch(API_ROUTES.devicePresets, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      data?: { presetId: string | null; overrides?: Record<string, boolean>; updatedAt?: string };
    };
    if (!payload.data) return;
    setState({
      presetId: payload.data.presetId,
      overrides: payload.data.overrides ?? {},
      lastToggleAt: payload.data.updatedAt ?? state.lastToggleAt,
    });
  } catch {
    // ignore
  }
};
