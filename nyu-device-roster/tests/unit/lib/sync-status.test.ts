import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  getSyncStatus,
  markSyncError,
  markSyncRunning,
  markSyncSuccess,
  resetSyncStatusForTests,
  subscribeToSyncStatus,
} from "@/lib/sync-status";

describe("sync status store", () => {
  beforeEach(() => {
    resetSyncStatusForTests();
  });

  it("starts idle and notifies subscribers immediately", () => {
    const spy = vi.fn();
    const unsubscribe = subscribeToSyncStatus(spy);

    expect(spy).toHaveBeenCalledWith({ state: "idle" });
    expect(getSyncStatus()).toEqual({ state: "idle" });
    unsubscribe();
  });

  it("tracks running → success lifecycle", () => {
    const spy = vi.fn();
    const unsubscribe = subscribeToSyncStatus(spy);

    markSyncRunning({ runId: "run-1", requestedBy: "lead@nyu.edu" });
    expect(getSyncStatus()).toMatchObject({
      state: "running",
      runId: "run-1",
      requestedBy: "lead@nyu.edu",
    });

    markSyncSuccess({
      runId: "run-1",
      metrics: { added: 5, updated: 2, unchanged: 10, durationMs: 1200 },
    });
    expect(getSyncStatus()).toMatchObject({
      state: "success",
      runId: "run-1",
      metrics: { added: 5, updated: 2, unchanged: 10, durationMs: 1200 },
    });

    expect(spy).toHaveBeenCalledTimes(3); // idle, running, success
    unsubscribe();
  });

  it("records errors", () => {
    const spy = vi.fn();
    subscribeToSyncStatus(spy);

    markSyncError({
      runId: "run-2",
      errorCode: "SYNC_TIMEOUT",
      message: "Sync exceeded SLA",
    });

    expect(getSyncStatus()).toMatchObject({
      state: "error",
      runId: "run-2",
      errorCode: "SYNC_TIMEOUT",
    });
    expect(spy).toHaveBeenCalledTimes(2); // idle + error
  });
});
