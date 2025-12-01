import { spawnSync } from "node:child_process";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import connectToDatabase, { resetDatabaseConnectionForTests } from "@/lib/db";
import { runSmoke } from "../../scripts/smoke";

let replSet: MongoMemoryReplSet | null = null;
let skipSuite = false;

const resolveSystemBinary = () => {
  if (process.env.MONGOMS_SYSTEM_BINARY?.trim()) {
    return process.env.MONGOMS_SYSTEM_BINARY.trim();
  }
  const result = spawnSync("which", ["mongod"], { encoding: "utf-8" });
  if (result.status === 0) {
    const candidate = result.stdout.trim();
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

try {
  const systemBinary = resolveSystemBinary();
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: systemBinary ? { systemBinary } : undefined,
  });
} catch (error) {
  skipSuite = true;
  console.warn("Skipping smoke integration tests:", error);
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
  await connectToDatabase(replSet.getUri());
  await mongoose.connection.db.dropDatabase();
});

afterEach(() => {
  resetDatabaseConnectionForTests();
});

const describeIf = skipSuite ? describe.skip : describe;

describeIf("smoke run", () => {
  it("runs smoke steps and reports success", async () => {
    const summary = await runSmoke({ operator: "lead@example.com" });

    expect(summary.status).toBe("passed");
    expect(summary.steps.find((s) => s.name === "manual-sync")?.status).toBe("passed");
    expect(summary.steps.find((s) => s.name === "anonymization-toggle")?.status).toBe("passed");
    expect(summary.blockingIssues.length).toBe(0);
  });
});
