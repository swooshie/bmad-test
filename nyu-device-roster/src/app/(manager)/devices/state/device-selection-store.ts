"use client";

import { useSyncExternalStore } from "react";

type StoreState = {
  selectedDeviceId: string | null;
  isOpen: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let state: StoreState = {
  selectedDeviceId: null,
  isOpen: false,
};

const notify = () => {
  listeners.forEach((listener) => listener());
};

const setState = (partial: Partial<StoreState>) => {
  state = { ...state, ...partial };
  notify();
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDeviceSelection = () =>
  useSyncExternalStore(subscribe, () => state, () => state);

export const openDeviceDrawer = (deviceId: string) => {
  setState({ selectedDeviceId: deviceId, isOpen: true });
};

export const closeDeviceDrawer = () => {
  setState({ isOpen: false });
};

export const __resetDeviceSelection = () => {
  state = { selectedDeviceId: null, isOpen: false };
  notify();
};
