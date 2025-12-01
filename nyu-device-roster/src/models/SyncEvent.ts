import { Schema, model, models } from "mongoose";

const SYNC_EVENT_TYPES = [
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
  "DEVICE_DRAWER_ACTION",
  "DEVICE_HANDOFF_INITIATED",
  "DEVICE_AUDIT_EXPORT",
  "SERIAL_AUDIT",
  "MIGRATION_RUN",
  "SYNC_COLUMNS_CHANGED",
] as const;

export type SyncEventType = (typeof SYNC_EVENT_TYPES)[number];

export type SyncRunTrigger = "system" | "manual" | "scheduled";

export type SyncRunStatus = "success" | "failed" | "skipped";

export interface SyncRunMetadata {
  sheetId: string;
  runId: string;
  trigger: SyncRunTrigger;
  requestedBy: string | null;
  anonymized: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  rowsProcessed: number;
  rowsSkipped: number;
  skipped?: number;
  conflicts: number;
  rowCount: number;
  status: SyncRunStatus;
  queueLatencyMs?: number | null;
  reason?: string | null;
  anomalies?: string[];
  added?: number;
  updated?: number;
  unchanged?: number;
  legacyIdsUpdated?: number;
  serialConflicts?: number;
  columnsAdded?: number;
  columnsRemoved?: number;
  columnTotal?: number;
  columnVersion?: string;
  rowsAudited?: number;
  missingSerialCount?: number;
  skippedRows?: unknown[];
}

export type SyncEventMetadata = Record<string, unknown> | SyncRunMetadata;

export interface SyncEventAttributes {
  eventType: SyncEventType;
  route: string;
  method: string;
  reason?: string;
  requestId?: string;
  ip?: string;
  userEmail?: string | null;
  createdAt: Date;
  metadata?: SyncEventMetadata;
}

const syncEventSchema = new Schema<SyncEventAttributes>(
  {
    eventType: {
      type: String,
      required: true,
    enum: SYNC_EVENT_TYPES,
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

syncEventSchema.index({ createdAt: -1 });
syncEventSchema.index({ eventType: 1, "metadata.trigger": 1, createdAt: -1 });
syncEventSchema.index({ "metadata.status": 1, createdAt: -1 });

export const SyncEventModel =
  models.SyncEvent || model<SyncEventAttributes>("SyncEvent", syncEventSchema);

export default SyncEventModel;
