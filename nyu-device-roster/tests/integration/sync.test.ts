import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import connectToDatabase, { resetDatabaseConnectionForTests } from "@/lib/db";
import DeviceModel from "@/models/Device";
import SyncEventModel from "@/models/SyncEvent";
import { applyDeviceUpserts } from "@/workers/sync";
import { normalizeSheetRows } from "@/workers/sync/transform";

let replSet: MongoMemoryReplSet | null = null;
let skipSuite = false;

try {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
} catch (error) {
  skipSuite = true;
  console.warn("Skipping sync integration tests:", error);
}

afterAll(async () => {
  if (!skipSuite && mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  if (!skipSuite && replSet) {
    await replSet.stop();
  }
});

beforeEach(async () => {
  if (skipSuite || !replSet) {
    return;
  }
  await connectToDatabase(replSet.getUri());
  await mongoose.connection.db.dropDatabase();
});

afterEach(() => {
  resetDatabaseConnectionForTests();
});

const describeIf = skipSuite ? describe.skip : describe;

describeIf("applyDeviceUpserts", () => {
  it("upserts devices and tracks change counts", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const normalization = normalizeSheetRows(
      [
        {
          serial: "device-001",
          deviceId: "device-001",
          assignedTo: "Alex",
          status: "Active",
          condition: "Good",
          offboardingStatus: "",
        },
        {
          serial: "device-002",
          deviceId: "device-002",
          assignedTo: "Jamie",
          status: "Active",
          condition: "Needs Repair",
        },
      ],
      { sheetId: "sheet-1", now }
    );

    const firstRun = await applyDeviceUpserts(normalization.devices, {
      sheetId: "sheet-1",
      anomalies: normalization.anomalies,
      requestId: "req-1",
      runId: "run-1",
    });

    expect(firstRun.added).toBe(2);
    expect(firstRun.updated).toBe(0);
    expect(firstRun.unchanged).toBe(0);

    const secondNormalization = normalizeSheetRows(
      [
        {
          serial: "device-001",
          deviceId: "device-001",
          assignedTo: "Taylor",
          status: "Active",
          condition: "Good",
        },
        {
          serial: "device-002",
          deviceId: "device-002",
          assignedTo: "Jamie",
          status: "Active",
          condition: "Needs Repair",
        },
      ],
      { sheetId: "sheet-1", now: new Date("2025-01-02T00:00:00Z") }
    );

    const secondRun = await applyDeviceUpserts(secondNormalization.devices, {
      sheetId: "sheet-1",
      anomalies: secondNormalization.anomalies,
      requestId: "req-2",
      runId: "run-2",
    });

    expect(secondRun.added).toBe(0);
    expect(secondRun.updated).toBe(1);
    expect(secondRun.unchanged).toBe(1);

    const stored = await DeviceModel.findOne({
      serial: "device-001",
      sheetId: "sheet-1",
    }).lean();
    expect(stored?.assignedTo).toBe("Taylor");
    expect(stored?.lastSyncedAt).toBeInstanceOf(Date);

    const syncEvents = await SyncEventModel.countDocuments({
      "metadata.sheetId": "sheet-1",
    });
    expect(syncEvents).toBe(2);
  });
});
