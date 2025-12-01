import connectToDatabase from "@/lib/db";
import { recordAuditLogFromSyncEvent } from "@/lib/audit/auditLogs";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";

type DrawerEventPayload = {
  serial: string;
  eventType: SyncEventType;
  route: string;
  method: string;
  actor: string | null;
  metadata?: Record<string, unknown>;
};

export const recordSyncEvent = async (payload: DrawerEventPayload) => {
  await connectToDatabase();
  await SyncEventModel.create({
    eventType: payload.eventType,
    route: payload.route,
    method: payload.method,
    userEmail: payload.actor,
    reason: payload.eventType,
    metadata: { ...(payload.metadata ?? {}), serial: payload.serial },
  });

  await recordAuditLogFromSyncEvent({
    eventType: payload.eventType,
    action: payload.eventType,
    actor: payload.actor,
    status: "success",
    context: { ...(payload.metadata ?? {}), serial: payload.serial, route: payload.route },
  });
};
