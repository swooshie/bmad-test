export type SyncStatusState =
  | {
      state: "idle";
    }
  | {
      state: "running";
      runId: string;
      startedAt: string;
      requestedBy: string | null;
    }
  | {
      state: "success";
      runId: string;
      completedAt: string;
      metrics: {
        added: number;
        updated: number;
        unchanged: number;
        durationMs: number;
      };
    }
  | {
    state: "error";
    runId: string;
    completedAt: string;
    errorCode: string;
    message: string;
  };

export type SyncStatusSubscriber = (state: SyncStatusState) => void;

let statusSnapshot: SyncStatusState = { state: "idle" };
const subscribers = new Set<SyncStatusSubscriber>();

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
}) => {
  statusSnapshot = {
    state: "running",
    runId: payload.runId,
    startedAt: new Date().toISOString(),
    requestedBy: payload.requestedBy,
  };
  notify();
};

export const markSyncSuccess = (payload: {
  runId: string;
  metrics: { added: number; updated: number; unchanged: number; durationMs: number };
}) => {
  statusSnapshot = {
    state: "success",
    runId: payload.runId,
    completedAt: new Date().toISOString(),
    metrics: payload.metrics,
  };
  notify();
};

export const markSyncError = (payload: {
  runId: string;
  errorCode: string;
  message: string;
}) => {
  statusSnapshot = {
    state: "error",
    runId: payload.runId,
    completedAt: new Date().toISOString(),
    errorCode: payload.errorCode,
    message: payload.message,
  };
  notify();
};

export const resetSyncStatusForTests = () => {
  statusSnapshot = { state: "idle" };
  subscribers.clear();
};
