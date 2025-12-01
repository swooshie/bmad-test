"use client";

import { useSyncExternalStore } from "react";

type StoreState = {
  selectedSerial: string | null;
  isOpen: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let state: StoreState = {
  selectedSerial: null,
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

export const openDeviceDrawer = (serial: string) => {
  setState({ selectedSerial: serial, isOpen: true });
};

export const closeDeviceDrawer = () => {
  setState({ isOpen: false });
};

export const __resetDeviceSelection = () => {
  state = { selectedSerial: null, isOpen: false };
  notify();
};
