#!/usr/bin/env node
import "tsconfig-paths/register.js";
import fs from "node:fs/promises";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv();

import connectToDatabase from "@/lib/db";
import { AppError, mapToAppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging";
import DeviceModel from "@/models/Device";
import SyncEventModel from "@/models/SyncEvent";

type BaselineDevice = {
  deviceId: string;
  sheetId: string;
  assignedTo: string;
  status: string;
  condition: string;
  offboardingStatus?: string | null;
  lastSeen?: string | null;
  lastSyncedAt: string;
  contentHash: string;
};

const SNAPSHOT_ENV = "SYNC_BASELINE_PATH";
const DEFAULT_BASELINE_PATH = path.resolve(
  process.cwd(),
  "data/devices-baseline.json"
);

export const parseArgs = () => {
  const snapshotArg = process.argv.find((arg) => arg.startsWith("--snapshot="));
  return snapshotArg ? snapshotArg.split("=").slice(1).join("=") : undefined;
};

export const resolveBaselinePath = () =>
  parseArgs() ||
  process.env[SNAPSHOT_ENV] ||
  DEFAULT_BASELINE_PATH;

export const readBaseline = async (filePath: string): Promise<BaselineDevice[]> => {
  const payload = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed)) {
    throw new AppError({
      code: "ROLLBACK_FAILED",
      message: `Baseline snapshot at ${filePath} is not an array`,
    });
  }

  const normalized = parsed.map((record, index) => {
    const missingField = [
      "deviceId",
      "sheetId",
      "assignedTo",
      "status",
      "condition",
      "lastSyncedAt",
      "contentHash",
    ].find((field) => !(field in record));

    if (missingField) {
      throw new AppError({
        code: "ROLLBACK_FAILED",
        message: `Baseline record #${index + 1} is missing field "${missingField}"`,
      });
    }

    return {
      deviceId: String(record.deviceId),
      sheetId: String(record.sheetId),
      assignedTo: String(record.assignedTo),
      status: String(record.status),
      condition: String(record.condition),
      offboardingStatus:
        record.offboardingStatus === undefined
          ? null
          : record.offboardingStatus,
      lastSeen:
        record.lastSeen === undefined || record.lastSeen === null
          ? null
          : String(record.lastSeen),
      lastSyncedAt: String(record.lastSyncedAt),
      contentHash: String(record.contentHash),
    } satisfies BaselineDevice;
  });

  return normalized;
};

export const toDeviceDocs = (records: BaselineDevice[]) =>
  records.map((device) => ({
    deviceId: device.deviceId,
    sheetId: device.sheetId,
    assignedTo: device.assignedTo,
    status: device.status,
    condition: device.condition,
    offboardingStatus: device.offboardingStatus ?? null,
    lastSeen: device.lastSeen ? new Date(device.lastSeen) : null,
    lastSyncedAt: new Date(device.lastSyncedAt),
    contentHash: device.contentHash,
  }));

export const recordResetEvent = async (
  metadata: {
    restoredCount: number;
    snapshotPath: string;
  },
  session?: mongoose.ClientSession
) => {
  await SyncEventModel.create(
    {
      eventType: "SYNC_RUN",
      route: "scripts/reset-sync",
      method: "CLI",
      metadata: {
        trigger: "system",
        status: "rollback",
        restoredCount: metadata.restoredCount,
        snapshotPath: metadata.snapshotPath,
      },
    },
    { session }
  );
};

export const runRollback = async (baselinePath: string) => {
  logger.info(
    { event: "SYNC_ROLLBACK_BEGIN", snapshotPath: baselinePath },
    "Starting sync rollback with baseline snapshot"
  );

  try {
    const baseline = await readBaseline(baselinePath);
    const docs = toDeviceDocs(baseline);
    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await DeviceModel.deleteMany({}, { session });
        if (docs.length > 0) {
          await DeviceModel.insertMany(docs, { session, ordered: false });
        }
        await recordResetEvent(
          {
            restoredCount: docs.length,
            snapshotPath: baselinePath,
          },
          session
        );
      });
      logger.info(
        {
          event: "SYNC_ROLLBACK_COMPLETE",
          restoredCount: docs.length,
          snapshotPath: baselinePath,
        },
        "Rollback completed successfully"
      );
    } finally {
      await session.endSession();
    }
  } catch (error) {
    const mapped = mapToAppError(error, "ROLLBACK_FAILED");
    logger.error(
      {
        event: "SYNC_ROLLBACK_FAILED",
        referenceId: mapped.referenceId,
        error,
      },
      mapped.message
    );
    process.exitCode = 1;
    console.error(
      `Rollback failed [${mapped.code}] (${mapped.referenceId}): ${mapped.message}`
    );
  } finally {
    await mongoose.connection.close().catch(() => undefined);
  }
};

void runRollback(resolveBaselinePath());
