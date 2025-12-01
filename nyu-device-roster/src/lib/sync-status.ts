export type SyncTriggerType = "manual" | "scheduled" | "system";

export type SyncStatusWarning =
  | {
      type: "duration" | "streak";
      message: string;
    }
  | {
    type: "schema-change";
    message: string;
    details?: {
      added: string[];
      removed: string[];
      renamed: string[];
      currentVersion?: string | null;
      previousVersion?: string | null;
    };
  };

export type SyncStatusState =
  | {
      state: "idle";
      warning?: SyncStatusWarning;
    }
  | {
      state: "running";
      runId: string;
      startedAt: string;
      requestedBy: string | null;
      trigger: SyncTriggerType;
      mode?: "live" | "dry-run";
      warning?: SyncStatusWarning;
    }
  | {
      state: "success";
      runId: string;
      completedAt: string;
      requestedBy: string | null;
      trigger: SyncTriggerType;
      mode?: "live" | "dry-run";
      metrics: {
        added: number;
        updated: number;
        unchanged: number;
        rowsProcessed: number;
        rowsSkipped: number;
        conflicts: number;
        durationMs: number;
        serialConflicts: number;
        legacyIdsUpdated: number;
        columnsAdded?: number;
        columnsRemoved?: number;
        columnTotal?: number;
        columnsVersion?: string;
      };
      warning?: SyncStatusWarning;
    }
  | {
      state: "error";
      runId: string;
      completedAt: string;
      requestedBy: string | null;
      trigger: SyncTriggerType;
      mode?: "live" | "dry-run";
      errorCode: string;
      message: string;
      recommendation?: string;
      referenceId?: string;
      warning?: SyncStatusWarning;
    };

export type SyncStatusSubscriber = (state: SyncStatusState) => void;

let statusSnapshot: SyncStatusState = { state: "idle" };
const subscribers = new Set<SyncStatusSubscriber>();
let failureStreak = 0;

export const getSyncStatus = () => statusSnapshot;

const notify = () => {
  subscribers.forEach((subscriber) => {
    try {
      subscriber(statusSnapshot);
    } catch {
      // ignore subscriber errors
    }
  });
};

export const subscribeToSyncStatus = (fn: SyncStatusSubscriber) => {
  subscribers.add(fn);
  fn(statusSnapshot);
  return () => subscribers.delete(fn);
};

export const markSyncRunning = (payload: {
  runId: string;
  requestedBy: string | null;
  trigger: SyncTriggerType;
  mode?: "live" | "dry-run";
}) => {
  statusSnapshot = {
    state: "running",
    runId: payload.runId,
    startedAt: new Date().toISOString(),
    requestedBy: payload.requestedBy,
    trigger: payload.trigger,
    mode: payload.mode,
  };
  notify();
};

export const markSyncSuccess = (payload: {
  runId: string;
  requestedBy: string | null;
  trigger: SyncTriggerType;
  mode?: "live" | "dry-run";
  metrics: {
    added: number;
    updated: number;
    unchanged: number;
    rowsProcessed: number;
    rowsSkipped: number;
    conflicts: number;
    durationMs: number;
    serialConflicts: number;
    legacyIdsUpdated: number;
    columnsAdded?: number;
    columnsRemoved?: number;
    columnTotal?: number;
    columnsVersion?: string;
  };
  schemaChange?: {
    added: string[];
    removed: string[];
    renamed: string[];
    currentVersion?: string | null;
    previousVersion?: string | null;
  };
}) => {
  failureStreak = 0;
  const durationWarning =
    payload.metrics.durationMs > 5 * 60 * 1000
      ? {
          type: "duration",
          message: `Run exceeded 5 minutes (${(
            payload.metrics.durationMs / 60000
          ).toFixed(1)} min).`,
        }
      : undefined;
  const schemaWarning =
    payload.schemaChange &&
    (payload.schemaChange.added.length > 0 ||
      payload.schemaChange.removed.length > 0 ||
      payload.schemaChange.renamed.length > 0)
      ? {
          type: "schema-change" as const,
          message: "Schema changed in latest sync run",
          details: {
            added: payload.schemaChange.added,
            removed: payload.schemaChange.removed,
            renamed: payload.schemaChange.renamed,
            currentVersion: payload.schemaChange.currentVersion,
            previousVersion: payload.schemaChange.previousVersion,
          },
        }
      : undefined;

  statusSnapshot = {
    state: "success",
    runId: payload.runId,
    completedAt: new Date().toISOString(),
    requestedBy: payload.requestedBy,
    trigger: payload.trigger,
    mode: payload.mode,
    metrics: payload.metrics,
    warning: durationWarning ?? schemaWarning,
  };
  notify();
};

export const markSyncError = (payload: {
  runId: string;
  requestedBy: string | null;
  trigger: SyncTriggerType;
  mode?: "live" | "dry-run";
  errorCode: string;
  message: string;
  recommendation?: string;
  referenceId?: string;
}) => {
  failureStreak += 1;
  const warning =
    failureStreak >= 2
      ? {
          type: "streak",
          message: `${failureStreak} consecutive failures detected`,
        }
      : undefined;
  statusSnapshot = {
    state: "error",
    runId: payload.runId,
    completedAt: new Date().toISOString(),
    requestedBy: payload.requestedBy,
    trigger: payload.trigger,
    mode: payload.mode,
    errorCode: payload.errorCode,
    message: payload.message,
    recommendation: payload.recommendation,
    referenceId: payload.referenceId,
    warning,
  };
  notify();
};

export const resetSyncStatusForTests = () => {
  statusSnapshot = { state: "idle" };
  subscribers.clear();
  failureStreak = 0;
};
