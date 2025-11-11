import { Schema, model, models } from "mongoose";

export interface DeviceAttributes {
  deviceId: string;
  sheetId: string;
  assignedTo: string;
  status: string;
  condition: string;
  offboardingStatus?: string | null;
  lastSeen?: Date | null;
  lastSyncedAt: Date;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<DeviceAttributes>(
  {
    deviceId: { type: String, required: true, trim: true },
    sheetId: { type: String, required: true, trim: true },
    assignedTo: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    condition: { type: String, required: true, trim: true },
    offboardingStatus: { type: String, default: null },
    lastSeen: { type: Date, default: null },
    lastSyncedAt: { type: Date, required: true },
    contentHash: { type: String, required: true },
  },
  {
    collection: "devices",
    timestamps: { createdAt: true, updatedAt: true },
  }
);

deviceSchema.index({ deviceId: 1, sheetId: 1 }, { unique: true, name: "device_sheet_unique" });
deviceSchema.index({ assignedTo: 1 }, { name: "device_assigned_to_idx" });
deviceSchema.index({ lastSyncedAt: -1 }, { name: "device_last_synced_idx" });

export const DeviceModel = models.Device || model<DeviceAttributes>("Device", deviceSchema);

export default DeviceModel;
