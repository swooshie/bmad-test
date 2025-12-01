import connectToDatabase from "@/lib/db";
import logger from "@/lib/logging";
import AuditLogModel, {
  type AuditEventType,
  type AuditStatus,
} from "@/models/AuditLog";
import type { SyncEventType } from "@/models/SyncEvent";

type AuditContext = Record<string, unknown> | undefined;

export type AuditLogPayload = {
  eventType: AuditEventType;
  action: string;
  actor?: string | null;
  status?: AuditStatus;
  errorCode?: string | null;
  context?: AuditContext;
};

export type AccessibilityAuditLog = {
  tool: "axe" | "lighthouse" | "manual";
  target: string;
  result: "pass" | "fail";
  tester?: string | null;
  summary?: string | null;
  score?: number | null;
  violations?: number | null;
  artifacts?: string[];
  timestamp?: string;
};

export const recordAuditLog = async (payload: AuditLogPayload): Promise<void> => {
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error({ event: "AUDIT_LOG_DB_ERROR", error }, "Unable to connect before audit log write");
    return;
  }

  try {
    await AuditLogModel.create({
      eventType: payload.eventType,
      action: payload.action,
      actor: payload.actor ?? null,
      status: payload.status ?? "success",
      errorCode: payload.errorCode ?? null,
      context: payload.context,
    });
  } catch (error) {
    logger.error(
      { event: "AUDIT_LOG_WRITE_FAILED", action: payload.action, eventType: payload.eventType, error },
      "Unable to persist audit log entry"
    );
  }
};

const mapSyncEventType = (eventType: SyncEventType): AuditEventType => {
  switch (eventType) {
    case "SYNC_RUN":
      return "sync";
    case "ANONYMIZATION_TOGGLED":
      return "anonymization";
    case "ALLOWLIST_CHANGE":
    case "ALLOWLIST_ACCESS_DENIED":
      return "allowlist-change";
    default:
      return "governance";
  }
};

export const recordAuditLogFromSyncEvent = async (payload: {
  eventType: SyncEventType;
  action?: string;
  actor?: string | null;
  status?: AuditStatus;
  errorCode?: string | null;
  context?: AuditContext;
}) => {
  await recordAuditLog({
    eventType: mapSyncEventType(payload.eventType),
    action: payload.action ?? payload.eventType,
    actor: payload.actor,
    status: payload.status,
    errorCode: payload.errorCode,
    context: payload.context,
  });
};
