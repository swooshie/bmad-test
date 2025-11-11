import { Schema, model, models } from "mongoose";

export type AllowlistChangeSource = "cli" | "admin-endpoint";

export interface AllowlistChange {
  operatorId: string;
  timestamp: Date;
  emailsAdded: string[];
  emailsRemoved: string[];
  source: AllowlistChangeSource;
}

export interface SyncSettings {
  enabled: boolean;
  intervalMinutes: number;
  timezone: string;
}

export interface ConfigAttributes {
  allowlist: string[];
  devicesSheetId: string;
  collectionName: string;
  lastUpdatedAt: Date;
  updatedBy: string;
  changes: AllowlistChange[];
  sync: SyncSettings;
}

const allowlistChangeSchema = new Schema<AllowlistChange>(
  {
    operatorId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    emailsAdded: { type: [String], default: [] },
    emailsRemoved: { type: [String], default: [] },
    source: {
      type: String,
      enum: ["cli", "admin-endpoint"],
      default: "cli",
    },
  },
  { _id: false }
);

const configSchema = new Schema<ConfigAttributes>(
  {
    allowlist: {
      type: [String],
      required: true,
      default: [],
    },
    devicesSheetId: {
      type: String,
      required: true,
      trim: true,
    },
    collectionName: {
      type: String,
      required: true,
      trim: true,
    },
    lastUpdatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      required: true,
      trim: true,
    },
    changes: {
      type: [allowlistChangeSchema],
      default: [],
    },
    sync: {
      enabled: {
        type: Boolean,
        default: true,
      },
      intervalMinutes: {
        type: Number,
        default: 2,
        min: 1,
        max: 60,
      },
      timezone: {
        type: String,
        default: "Etc/UTC",
      },
    },
  },
  {
    collection: "config",
  }
);

export const ConfigModel = models.Config || model<ConfigAttributes>("Config", configSchema);

export default ConfigModel;
