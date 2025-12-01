import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { MongoMemoryReplSet } from "mongodb-memory-server";

import { recordAuditLogFromSyncEvent } from "@/lib/audit/auditLogs";
import { recordAnonymizationToggleEvent } from "@/lib/audit/syncEvents";
import connectToDatabase, {
  closeDatabaseConnection,
  resetDatabaseConnectionForTests,
} from "@/lib/db";
import { logAnonymizationToggle, logger } from "@/lib/logging";
import { aggregateSyncMetrics } from "@/lib/metrics/syncAggregations";
import DeviceModel from "@/models/Device";
import { runDeviceSync } from "@/workers/sync";
import SyncEventModel from "@/models/SyncEvent";

type SmokeStep = {
  name: string;
  status: "passed" | "failed";
  detail?: string;
  durationMs: number;
  error?: string;
};

type SmokeSummary = {
  operator: string;
  requestId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  steps: SmokeStep[];
  blockingIssues: string[];
};

const defaultRows = [
  {
    serial: "demo-001",
    deviceId: "demo-001",
    assignedTo: "Alex",
    status: "Active",
    condition: "Good",
    offboardingStatus: "",
  },
  {
    serial: "demo-002",
    deviceId: "demo-002",
    assignedTo: "Jordan",
    status: "Active",
    condition: "Needs Repair",
  },
];

type RunSmokeOptions = {
  operator?: string;
  jsonOutputPath?: string;
};

export const runSmoke = async (options?: RunSmokeOptions): Promise<SmokeSummary> => {
  const operator = options?.operator ?? process.env.SMOKE_OPERATOR_EMAIL ?? "smoke@example.com";
  const requestId = randomUUID();
  const startedAt = Date.now();

  const steps: SmokeStep[] = [];
  const blockingIssues: string[] = [];

  const resolvedSystemBinary = (() => {
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
  })();

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: resolvedSystemBinary ? { systemBinary: resolvedSystemBinary } : undefined,
  });
  const mongoUri = replSet.getUri();

  try {
    // Mock login step
    const loginStart = Date.now();
    steps.push({
      name: "mock-login",
      status: "passed",
      durationMs: Date.now() - loginStart,
      detail: `Mocked session for ${operator}`,
    });

    // Connect to isolated database
    const dbStart = Date.now();
    process.env.MONGODB_URI = process.env.MONGODB_URI ?? mongoUri;
    await connectToDatabase(mongoUri);
    steps.push({
      name: "connect-db",
      status: "passed",
      durationMs: Date.now() - dbStart,
      detail: "Connected to MongoMemoryServer",
    });

    // Trigger manual sync via worker with override rows
    const syncStart = Date.now();
    const runId = randomUUID();
    const syncResult = await runDeviceSync({
      sheetId: "smoke-sheet",
      requestId,
      runId,
      trigger: { type: "manual", requestedBy: operator, anonymized: false },
      overrideRows: defaultRows,
    });

    await recordAuditLogFromSyncEvent({
      eventType: "SYNC_RUN",
      action: "SMOKE_SYNC",
      actor: operator,
      status: "success",
      context: {
        runId,
        requestId,
        sheetId: syncResult.sheetId,
        rowCount: syncResult.rowCount,
        durationMs: syncResult.durationMs,
      },
    });

    steps.push({
      name: "manual-sync",
      status: "passed",
      durationMs: Date.now() - syncStart,
      detail: `rows=${syncResult.rowCount}, added=${syncResult.upsert.added}, updated=${syncResult.upsert.updated}`,
    });

    const telemetryStart = Date.now();
    const columnEvent = await SyncEventModel.findOne({ eventType: "SYNC_COLUMNS_CHANGED" })
      .sort({ createdAt: -1 })
      .lean();
    const columnVersion = (columnEvent?.metadata as { columnVersion?: string } | undefined)?.columnVersion;
    if (!columnVersion) {
      throw new Error("Missing SYNC_COLUMNS_CHANGED telemetry with columnVersion");
    }
    steps.push({
      name: "telemetry-columns",
      status: "passed",
      durationMs: Date.now() - telemetryStart,
      detail: `version=${columnVersion}`,
    });

    const metricsStart = Date.now();
    const metricsSnapshot = await aggregateSyncMetrics();
    const manualAggregate = metricsSnapshot.perTrigger.find((entry) => entry.trigger === "manual");
    if (!manualAggregate || manualAggregate.runs === 0) {
      throw new Error("Metrics aggregation missing manual trigger data");
    }
    steps.push({
      name: "metrics-aggregation",
      status: "passed",
      durationMs: Date.now() - metricsStart,
      detail: `manualRuns=${manualAggregate.runs}, success=${manualAggregate.success}`,
    });

    // Fetch grid data
    const gridStart = Date.now();
    const devices = await DeviceModel.find({}).lean();
    if (devices.length === 0) {
      throw new Error("Grid fetch returned zero devices");
    }
    steps.push({
      name: "grid-fetch",
      status: "passed",
      durationMs: Date.now() - gridStart,
      detail: `devices=${devices.length}`,
    });

    // Toggle anonymization
    const anonStart = Date.now();
    await recordAnonymizationToggleEvent({
      route: "/api/devices/anonymize",
      method: "POST",
      enabled: true,
      userEmail: operator,
      requestId,
    });
    logAnonymizationToggle({ enabled: true, userEmail: operator, requestId });
    steps.push({
      name: "anonymization-toggle",
      status: "passed",
      durationMs: Date.now() - anonStart,
      detail: "Toggled anonymization on",
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Smoke run failure", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("Smoke run failure", error);
    }
    const message = error instanceof Error ? error.message : String(error);
    steps.push({
      name: "error",
      status: "failed",
      durationMs: 0,
      error: message,
    });
    blockingIssues.push(message);
  } finally {
    try {
      await replSet.stop();
    } catch (error) {
      logger.warn({ event: "SMOKE_MONGO_STOP_FAILED", error }, "Failed to stop MongoMemoryServer");
    }
    await closeDatabaseConnection();
    resetDatabaseConnectionForTests();
  }

  const finishedAt = Date.now();
  const failed = steps.some((step) => step.status === "failed");

  const summary: SmokeSummary = {
    operator,
    requestId,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    status: failed ? "failed" : "passed",
    steps,
    blockingIssues,
  };

  if (options?.jsonOutputPath) {
    await writeFile(options.jsonOutputPath, JSON.stringify(summary, null, 2), "utf-8");
  }

  const heading = failed ? "Smoke Test FAILED" : "Smoke Test PASSED";
  logger.info({ event: "SMOKE_RESULT", status: summary.status, requestId }, heading);
  // Human-readable stdout
  // eslint-disable-next-line no-console
  console.log(`\n${heading} (operator=${operator}, requestId=${requestId})`);
  for (const step of steps) {
    const emoji = step.status === "passed" ? "✅" : "❌";
    // eslint-disable-next-line no-console
    console.log(`${emoji} ${step.name} (${step.durationMs}ms)${step.detail ? ` — ${step.detail}` : ""}`);
    if (step.error) {
      // eslint-disable-next-line no-console
      console.log(`   error: ${step.error}`);
    }
  }

  return summary;
};

const runCli = async () => {
  const args = process.argv.slice(2);
  const jsonIndex = args.findIndex((arg) => arg === "--json");
  const jsonOutputPath = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
  const operatorIndex = args.findIndex((arg) => arg === "--operator");
  const operator = operatorIndex >= 0 ? args[operatorIndex + 1] : undefined;

  const summary = await runSmoke({ operator, jsonOutputPath });
  return summary.status === "failed" ? 1 : 0;
};

const isDirectRun = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`)) : "";
  return current === invoked;
};

if (isDirectRun()) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runCli()
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error("Smoke CLI execution failed", error);
      process.exit(1);
    });
}

export default runSmoke;
