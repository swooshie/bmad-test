import connectToDatabase from "@/lib/db";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";
import logger from "@/lib/logging";
import type { AllowlistDiff } from "@/lib/config";

export type AuthFailureAuditPayload = {
  route: string;
  method: string;
  reason: string;
  requestId?: string;
  ip?: string;
  userEmail?: string | null;
};

export const recordAuthFailureEvent = async (
  payload: AuthFailureAuditPayload
): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "AUTH_INVALID_SESSION" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: payload.reason,
    requestId: payload.requestId,
    ip: payload.ip,
    userEmail: payload.userEmail ?? null,
  });
};

export const recordConfigValidationEvent = async (payload: {
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error(
      { event: "CONFIG_VALIDATION_AUDIT_FAILED", reason: payload.reason, error },
      "Unable to persist config validation event"
    );
    return;
  }

  await SyncEventModel.create({
    eventType: "CONFIG_VALIDATION" as SyncEventType,
    route: "startup",
    method: "SYSTEM",
    reason: payload.reason,
    metadata: payload.metadata ?? {},
  });
};

export const recordAllowlistChangeEvent = async (payload: {
  route: string;
  method: string;
  diff: AllowlistDiff;
  userEmail: string | null;
  requestId?: string;
  ip?: string;
}): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "ALLOWLIST_CHANGE" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: "ALLOWLIST_UPDATED",
    userEmail: payload.userEmail,
    requestId: payload.requestId,
    ip: payload.ip,
    metadata: {
      added: payload.diff.added,
      removed: payload.diff.removed,
      unchanged: payload.diff.unchanged,
    },
  });
};

export const recordAllowlistAccessDeniedEvent = async (payload: {
  route: string;
  method: string;
  reason: string;
  userEmail: string | null;
  requestId?: string;
  ip?: string;
}): Promise<void> => {
  await connectToDatabase();

  await SyncEventModel.create({
    eventType: "ALLOWLIST_ACCESS_DENIED" as SyncEventType,
    route: payload.route,
    method: payload.method,
    reason: payload.reason,
    userEmail: payload.userEmail,
    requestId: payload.requestId,
    ip: payload.ip,
  });
};
