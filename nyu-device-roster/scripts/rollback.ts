import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { performance } from "node:perf_hooks";

import { recordAuditLog } from "@/lib/audit/auditLogs";
import connectToDatabase from "@/lib/db";
import { logSecretManagerAlert, logger } from "@/lib/logging";
import AuditLogModel from "@/models/AuditLog";
import ConfigModel from "@/models/Config";
import DeviceModel from "@/models/Device";

type SnapshotDevice = {
  deviceId: string;
  sheetId: string;
  assignedTo: string;
  status: string;
  condition: string;
  offboardingStatus?: string | null;
  offboardingMetadata?: Record<string, unknown> | null;
  lastTransferNotes?: string | null;
  lastSeen?: string | null;
  lastSyncedAt: string;
  contentHash: string;
};

type SnapshotConfig = {
  collectionName: string;
  allowlist: string[];
  devicesSheetId: string;
  lastUpdatedAt: string;
  updatedBy: string;
  sync?: {
    enabled?: boolean;
    intervalMinutes?: number;
    timezone?: string;
  };
  changes?: Array<Record<string, unknown>>;
};

type SnapshotAuditLog = {
  eventType: string;
  action: string;
  actor?: string | null;
  status: string;
  errorCode?: string | null;
  context?: Record<string, unknown>;
  createdAt?: string;
};

type SnapshotFile = {
  devices: SnapshotDevice[];
  config: SnapshotConfig[];
  audit_logs: SnapshotAuditLog[];
};

type RestoreCounts = {
  devicesUpserted: number;
  configUpserted: number;
  auditInserted: number;
};

type RestoreSummary = {
  operator: string;
  reset: boolean;
  snapshotPath: string;
  counts: RestoreCounts;
  durationMs: number;
};

const defaultSnapshotPath = "data/snapshots/baseline.json";

const parseArgs = (argv: string[]) => {
  const getVal = (flag: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  return {
    snapshotPath: getVal("--snapshot") ?? defaultSnapshotPath,
    operator: getVal("--operator") ?? process.env.SNAPSHOT_OPERATOR ?? "ops@example.com",
    mongoUri: getVal("--mongo-uri"),
    jsonOutput: getVal("--json"),
    confirm: argv.includes("--confirm"),
  };
};

const loadSnapshot = async (path: string): Promise<SnapshotFile> => {
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as SnapshotFile;
  return {
    devices: parsed.devices ?? [],
    config: parsed.config ?? [],
    audit_logs: parsed.audit_logs ?? [],
  };
};

const restoreDevices = async (devices: SnapshotDevice[]): Promise<number> => {
  if (devices.length === 0) return 0;

  const ops: Parameters<typeof DeviceModel.bulkWrite>[0] = [];
  devices.forEach((device) => {
    const serial = device.deviceId?.toLowerCase();
    if (!serial) {
      return;
    }
    ops.push({
      updateOne: {
        filter: { serial, sheetId: device.sheetId },
        update: {
          $set: {
            serial,
            legacyDeviceId: device.deviceId ?? null,
            assignedTo: device.assignedTo,
            status: device.status,
            condition: device.condition,
            offboardingStatus: device.offboardingStatus ?? null,
            offboardingMetadata: device.offboardingMetadata ?? null,
            lastTransferNotes: device.lastTransferNotes ?? null,
            lastSeen: device.lastSeen ? new Date(device.lastSeen) : null,
            lastSyncedAt: new Date(device.lastSyncedAt),
            contentHash: device.contentHash,
          },
        },
        upsert: true,
      },
    });
  });

  if (ops.length === 0) {
    return 0;
  }

  const result = await DeviceModel.bulkWrite(ops, { ordered: false });
  return (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0);
};

const restoreConfig = async (configs: SnapshotConfig[]): Promise<number> => {
  if (configs.length === 0) return 0;

  let total = 0;
  for (const entry of configs) {
    const res = await ConfigModel.replaceOne(
      { collectionName: entry.collectionName },
      {
        allowlist: entry.allowlist,
        devicesSheetId: entry.devicesSheetId,
        collectionName: entry.collectionName,
        lastUpdatedAt: new Date(entry.lastUpdatedAt),
        updatedBy: entry.updatedBy,
        changes: entry.changes ?? [],
        sync: {
          enabled: entry.sync?.enabled ?? true,
          intervalMinutes: entry.sync?.intervalMinutes ?? 2,
          timezone: entry.sync?.timezone ?? "Etc/UTC",
        },
      },
      {
        upsert: true,
      }
    );
    total += res.modifiedCount + res.upsertedCount;
  }
  return total;
};

const restoreAuditLogs = async (auditLogs: SnapshotAuditLog[]): Promise<number> => {
  if (auditLogs.length === 0) return 0;
  const payloads = auditLogs.map((entry) => ({
    eventType: entry.eventType,
    action: entry.action,
    actor: entry.actor ?? null,
    status: entry.status as "success" | "error" | "skipped",
    errorCode: entry.errorCode ?? null,
    context: entry.context ?? {},
    createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
  }));
  const result = await AuditLogModel.insertMany(payloads, { ordered: false });
  return result.length;
};

export const runRollback = async (options?: {
  snapshotPath?: string;
  operator?: string;
  mongoUri?: string;
  jsonOutput?: string;
  confirm?: boolean;
}): Promise<RestoreSummary> => {
  const snapshotPath = options?.snapshotPath ?? defaultSnapshotPath;
  const operator = options?.operator ?? process.env.SNAPSHOT_OPERATOR ?? "ops@example.com";
  const confirm = options?.confirm ?? process.env.RESET_CONFIRM === "yes";

  if (!confirm) {
    throw new Error("Confirmation required: pass --confirm or set RESET_CONFIRM=yes");
  }

  if (!operator) {
    throw new Error("Operator identity is required (set --operator or SNAPSHOT_OPERATOR)");
  }

  if (options?.mongoUri) {
    process.env.MONGODB_URI = options.mongoUri;
  }

  const start = performance.now();
  const snapshot = await loadSnapshot(snapshotPath);

  await connectToDatabase();

  const devicesUpserted = await restoreDevices(snapshot.devices);
  const configUpserted = await restoreConfig(snapshot.config);
  const auditInserted = await restoreAuditLogs(snapshot.audit_logs);

  const durationMs = Math.round(performance.now() - start);

  const summary: RestoreSummary = {
    operator,
    reset: true,
    snapshotPath,
    counts: { devicesUpserted, configUpserted, auditInserted },
    durationMs,
  };

  await recordAuditLog({
    eventType: "governance",
    action: "SNAPSHOT_RESTORE",
    actor: operator,
    status: "success",
    context: {
      reset: true,
      snapshotPath,
      durationMs,
      counts: summary.counts,
    },
  });

  if (options?.jsonOutput) {
    await writeFile(options.jsonOutput, JSON.stringify(summary, null, 2), "utf-8");
  }

  logger.info({ event: "SNAPSHOT_RESTORE", ...summary }, "Snapshot restore completed");
  return summary;
};

const runCli = async () => {
  const args = parseArgs(process.argv.slice(2));

  try {
    const summary = await runRollback({
      snapshotPath: args.snapshotPath,
      operator: args.operator,
      mongoUri: args.mongoUri,
      jsonOutput: args.jsonOutput,
      confirm: args.confirm,
    });

    const heading = summary.reset ? "Snapshot restore complete" : "Snapshot restore skipped";
    // eslint-disable-next-line no-console
    console.log(`\n${heading} (operator=${summary.operator}, duration=${summary.durationMs}ms)`);
    // eslint-disable-next-line no-console
    console.log(
      `devices upserted=${summary.counts.devicesUpserted}, config upserted=${summary.counts.configUpserted}, audit inserted=${summary.counts.auditInserted}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logSecretManagerAlert({
      event: "SECRET_MANAGER_FAILURE",
      secretKey: "mongoUri",
      reason: message,
    });
    logger.error({ event: "SNAPSHOT_RESTORE_FAILED", error }, "Snapshot restore failed");
    // eslint-disable-next-line no-console
    console.error("Snapshot restore failed:", message);
    process.exitCode = 1;
  }
};

const isDirectRun = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1]
    ? fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
    : "";
  return current === invoked;
};

if (isDirectRun()) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runCli();
}

export default runRollback;
