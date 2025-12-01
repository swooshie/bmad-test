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

    markSyncRunning({ runId: "run-1", requestedBy: "lead@nyu.edu", trigger: "manual" });
    expect(getSyncStatus()).toMatchObject({
      state: "running",
      runId: "run-1",
      requestedBy: "lead@nyu.edu",
    });

    markSyncSuccess({
      runId: "run-1",
      requestedBy: "lead@nyu.edu",
      trigger: "manual",
      metrics: {
        added: 5,
        updated: 2,
        unchanged: 10,
        rowsProcessed: 17,
        rowsSkipped: 0,
        conflicts: 1,
        durationMs: 1200,
        serialConflicts: 1,
        legacyIdsUpdated: 0,
      },
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
      requestedBy: "scheduler@nyu.edu",
      trigger: "scheduled",
      errorCode: "SYNC_TIMEOUT",
      message: "Sync exceeded SLA",
      recommendation: "Retry later",
      referenceId: "ref-123",
    });

    expect(getSyncStatus()).toMatchObject({
      state: "error",
      runId: "run-2",
      errorCode: "SYNC_TIMEOUT",
      recommendation: "Retry later",
      referenceId: "ref-123",
    });
    expect(spy).toHaveBeenCalledTimes(2); // idle + error
  });

  it("emits a duration warning when a run exceeds five minutes", () => {
    markSyncRunning({ runId: "run-3", requestedBy: "lead@nyu.edu", trigger: "manual" });
    markSyncSuccess({
      runId: "run-3",
      requestedBy: "lead@nyu.edu",
      trigger: "manual",
      metrics: {
        added: 1,
        updated: 1,
        unchanged: 0,
        rowsProcessed: 2,
        rowsSkipped: 0,
        conflicts: 0,
        durationMs: 301_000,
        serialConflicts: 0,
        legacyIdsUpdated: 0,
      },
    });

    expect(getSyncStatus()).toMatchObject({
      warning: expect.objectContaining({ type: "duration" }),
    });
  });

  it("raises a warning when failures happen consecutively", () => {
    markSyncError({
      runId: "run-4",
      requestedBy: "scheduler",
      trigger: "scheduled",
      errorCode: "SYNC_TIMEOUT",
      message: "first",
    });
    markSyncError({
      runId: "run-5",
      requestedBy: "scheduler",
      trigger: "scheduled",
      errorCode: "SYNC_TIMEOUT",
      message: "second",
    });

    expect(getSyncStatus()).toMatchObject({
      warning: { type: "streak", message: expect.stringContaining("2 consecutive") },
    });
  });
});
