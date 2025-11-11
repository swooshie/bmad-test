import { Schema, model, models } from "mongoose";

export interface SyncLockAttributes {
  key: string;
  locked: boolean;
  lockId?: string;
  lockedAt?: Date;
  releaseAt?: Date;
}

const syncLockSchema = new Schema<SyncLockAttributes>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    lockId: {
      type: String,
    },
    lockedAt: {
      type: Date,
    },
    releaseAt: {
      type: Date,
      default: () => new Date(0),
    },
  },
  {
    collection: "sync_locks",
    timestamps: false,
  }
);

syncLockSchema.index({ key: 1 }, { unique: true });

export const SyncLockModel =
  models.SyncLock || model<SyncLockAttributes>("SyncLock", syncLockSchema);

export default SyncLockModel;
