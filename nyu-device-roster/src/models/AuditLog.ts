import { Schema, model, models } from "mongoose";

export type AuditEventType =
  | "sync"
  | "anonymization"
  | "allowlist-change"
  | "governance"
  | "accessibility";

export type AuditStatus = "success" | "error" | "skipped";

export interface AuditLogAttributes {
  eventType: AuditEventType;
  action: string;
  actor?: string | null;
  status: AuditStatus;
  errorCode?: string | null;
  context?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogAttributes>(
  {
    eventType: {
      type: String,
      required: true,
      enum: ["sync", "anonymization", "allowlist-change", "governance", "accessibility"],
    },
    action: { type: String, required: true },
    actor: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["success", "error", "skipped"],
      default: "success",
    },
    errorCode: { type: String },
    context: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "audit_logs",
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ eventType: 1, createdAt: -1 });

export const AuditLogModel =
  models.AuditLog || model<AuditLogAttributes>("AuditLog", auditLogSchema);

export default AuditLogModel;
