import { Schema, model, models } from "mongoose";

export type SyncEventType =
  | "AUTH_INVALID_SESSION"
  | "SYNC_RUN"
  | "CUSTOM"
  | "CONFIG_VALIDATION"
  | "ALLOWLIST_CHANGE"
  | "ALLOWLIST_ACCESS_DENIED"
  | "GOVERNANCE_EXPORT"
  | "ANONYMIZATION_TOGGLED"
  | "FILTER_CHIP_UPDATED"
  | "ICON_ACTION_TRIGGERED"
  | "DEVICE_DRAWER_ACTION"
  | "DEVICE_HANDOFF_INITIATED"
  | "DEVICE_AUDIT_EXPORT";

export interface SyncEventAttributes {
  eventType: SyncEventType;
  route: string;
  method: string;
  reason?: string;
  requestId?: string;
  ip?: string;
  userEmail?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

const syncEventSchema = new Schema<SyncEventAttributes>(
  {
    eventType: {
      type: String,
      required: true,
    enum: [
      "AUTH_INVALID_SESSION",
      "SYNC_RUN",
      "CUSTOM",
      "CONFIG_VALIDATION",
      "ALLOWLIST_CHANGE",
      "ALLOWLIST_ACCESS_DENIED",
      "GOVERNANCE_EXPORT",
      "ANONYMIZATION_TOGGLED",
      "FILTER_CHIP_UPDATED",
      "ICON_ACTION_TRIGGERED",
    ],
    },
    route: { type: String, required: true },
    method: { type: String, required: true },
    reason: { type: String },
    requestId: { type: String },
    ip: { type: String },
    userEmail: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "sync_events",
  }
);

export const SyncEventModel =
  models.SyncEvent || model<SyncEventAttributes>("SyncEvent", syncEventSchema);

export default SyncEventModel;
