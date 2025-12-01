import { Schema, model, models } from "mongoose";

export interface DeviceOffboardingMetadata {
  lastActor?: string | null;
  lastAction?: string | null;
  lastTransferAt?: Date | null;
}

export interface DeviceAttributes {
  serial: string;
  legacyDeviceId?: string | null;
  sheetId: string;
  assignedTo: string;
  status: string;
  condition: string;
  offboardingStatus?: string | null;
  offboardingMetadata?: DeviceOffboardingMetadata;
  lastTransferNotes?: string | null;
  lastSeen?: Date | null;
  lastSyncedAt: Date;
  contentHash: string;
  serialMigratedAt?: Date | null;
  dynamicAttributes?: Record<string, string | number | boolean | null>;
  columnDefinitionsVersion?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const offboardingMetadataSchema = new Schema<DeviceOffboardingMetadata>(
  {
    lastActor: { type: String, default: null },
    lastAction: { type: String, default: null },
    lastTransferAt: { type: Date, default: null },
  },
  { _id: false }
);

const deviceSchema = new Schema<DeviceAttributes>(
  {
    serial: { type: String, required: true, trim: true, lowercase: true },
    legacyDeviceId: { type: String, default: null, trim: true },
    sheetId: { type: String, required: true, trim: true },
    assignedTo: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    condition: { type: String, required: true, trim: true },
    offboardingStatus: { type: String, default: null },
    offboardingMetadata: { type: offboardingMetadataSchema, default: undefined },
    lastTransferNotes: { type: String, default: null },
    lastSeen: { type: Date, default: null },
    lastSyncedAt: { type: Date, required: true },
    contentHash: { type: String, required: true },
    serialMigratedAt: { type: Date, default: null },
    dynamicAttributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: undefined,
    },
    columnDefinitionsVersion: { type: String, default: null },
  },
  {
    collection: "devices",
    timestamps: { createdAt: true, updatedAt: true },
  }
);

deviceSchema.index(
  { serial: 1 },
  {
    unique: true,
    name: "device_serial_unique",
    partialFilterExpression: {
      serial: { $exists: true, $type: "string" },
    },
  }
);
deviceSchema.index(
  { legacyDeviceId: 1, sheetId: 1 },
  {
    unique: true,
    name: "device_legacy_sheet_unique",
    partialFilterExpression: {
      legacyDeviceId: { $exists: true, $type: "string" },
    },
  }
);
deviceSchema.index({ assignedTo: 1 }, { name: "device_assigned_to_idx" });
deviceSchema.index({ lastSyncedAt: -1 }, { name: "device_last_synced_idx" });
deviceSchema.index({ "dynamicAttributes.$**": 1 }, { name: "device_dynamic_attributes_idx" });

export const DeviceModel = models.Device || model<DeviceAttributes>("Device", deviceSchema);

export default DeviceModel;
