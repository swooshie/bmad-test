import connectToDatabase from "@/lib/db";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";

type DrawerEventPayload = {
  deviceId: string;
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
    metadata: { ...(payload.metadata ?? {}), deviceId: payload.deviceId },
  });
};
