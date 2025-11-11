import connectToDatabase from "@/lib/db";
import SyncLockModel, { type SyncLockAttributes } from "@/models/SyncLock";

const LOCK_KEY = "device-sync";

const ensureLockDocument = async () => {
  await connectToDatabase();
  await SyncLockModel.updateOne(
    { key: LOCK_KEY },
    {
      $setOnInsert: {
        key: LOCK_KEY,
        locked: false,
        releaseAt: new Date(0),
      },
    },
    { upsert: true }
  );
};

type SyncLockState = (SyncLockAttributes & { _id?: unknown }) | null;

type SyncLockResult =
  | {
      acquired: true;
      lock: SyncLockState;
    }
  | {
      acquired: false;
      lock: SyncLockState;
    };

export const acquireSyncLock = async (options: { lockId: string; ttlMs: number }): Promise<SyncLockResult> => {
  await ensureLockDocument();
  const now = new Date();
  const releaseAt = new Date(now.getTime() + options.ttlMs);

  const updated = await SyncLockModel.findOneAndUpdate(
    {
      key: LOCK_KEY,
      $or: [{ locked: false }, { releaseAt: { $lte: now } }],
    },
    {
      $set: {
        locked: true,
        lockId: options.lockId,
        lockedAt: now,
        releaseAt,
      },
    },
    { new: true }
  ).lean();

  if (!updated || updated.lockId !== options.lockId) {
    const current = await SyncLockModel.findOne({ key: LOCK_KEY }).lean();
    return { acquired: false, lock: current ?? null };
  }

  return { acquired: true, lock: updated };
};

export const releaseSyncLock = async (lockId: string) => {
  await connectToDatabase();
  await SyncLockModel.updateOne(
    { key: LOCK_KEY, lockId },
    {
      $set: {
        locked: false,
        releaseAt: new Date(Date.now()),
      },
      $unset: {
        lockId: 1,
        lockedAt: 1,
      },
    }
  );
};

export const getCurrentSyncLock = async () => {
  await connectToDatabase();
  return SyncLockModel.findOne({ key: LOCK_KEY }).lean();
};
