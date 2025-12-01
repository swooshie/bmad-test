import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import connectToDatabase, { resetDatabaseConnectionForTests } from "@/lib/db";
import AuditLogModel from "@/models/AuditLog";
import ConfigModel from "@/models/Config";
import DeviceModel from "@/models/Device";
import { runRollback } from "../../scripts/rollback";

let replSet: MongoMemoryReplSet | null = null;
let skipSuite = false;

try {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
} catch (error) {
  skipSuite = true;
  console.warn("Skipping rollback integration tests:", error);
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
  if (skipSuite || !replSet) return;
  process.env.RESET_CONFIRM = "yes";
  process.env.MONGODB_URI = replSet.getUri();
  await connectToDatabase(replSet.getUri());
  await mongoose.connection.db.dropDatabase();
});

afterEach(() => {
  resetDatabaseConnectionForTests();
});

const describeIf = skipSuite ? describe.skip : describe;

describeIf("runRollback", () => {
  it("restores snapshot data and logs reset event", async () => {
    const summary = await runRollback({
      operator: "lead@example.com",
      snapshotPath: "data/snapshots/baseline.json",
      mongoUri: replSet?.getUri(),
      confirm: true,
    });

    expect(summary.counts.devicesUpserted).toBeGreaterThan(0);
    expect(summary.counts.configUpserted).toBeGreaterThan(0);
    expect(summary.counts.auditInserted).toBeGreaterThanOrEqual(1);
    expect(summary.reset).toBe(true);

    const device = await DeviceModel.findOne({ serial: "snapshot-001" }).lean();
    expect(device?.sheetId).toBe("snapshot-sheet");

    const config = await ConfigModel.findOne({ collectionName: "default" }).lean();
    expect(config?.devicesSheetId).toBe("snapshot-sheet");

    const audit = await AuditLogModel.findOne({ action: "SNAPSHOT_RESTORE" }).lean();
    expect(audit?.context?.reset).toBe(true);
  });
});
