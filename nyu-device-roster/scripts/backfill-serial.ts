#!/usr/bin/env node
import "tsconfig-paths/register.js";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import mongoose, { type FilterQuery } from "mongoose";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv();

import { ensureRuntimeConfig } from "@/lib/config";
import connectToDatabase from "@/lib/db";
import { AppError, mapToAppError } from "@/lib/errors/app-error";
import { fetchSheetData, type FetchSheetDataResult, type TypedRow } from "@/lib/google-sheets";
import { logger } from "@/lib/logging";
import DeviceModel, { type DeviceAttributes } from "@/models/Device";
import SyncEventModel from "@/models/SyncEvent";

export type SerialMigrationArgs = {
  dryRun: boolean;
  batchSize: number;
  resumeToken?: string;
  tabName?: string;
  requestId?: string;
};

const DEFAULT_BATCH_SIZE = 250;
const REPORT_DIR = path.resolve(process.cwd(), "docs/stories/reports");

const stringArg = (arg: string, prefix: string) =>
  arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;

export const parseCliArgs = (argv: string[]): SerialMigrationArgs => {
  const defaults: SerialMigrationArgs = {
    dryRun: true,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  return argv.reduce<SerialMigrationArgs>((acc, argument) => {
    if (argument === "--apply" || argument === "--confirm") {
      acc.dryRun = false;
      return acc;
    }
    if (argument === "--dry-run") {
      acc.dryRun = true;
      return acc;
    }
    const batchSize = stringArg(argument, "--batch-size=");
    if (batchSize) {
      const parsed = Number(batchSize);
      if (!Number.isNaN(parsed) && parsed > 0) {
        acc.batchSize = parsed;
      }
      return acc;
    }
    const resumeToken = stringArg(argument, "--resume-token=");
    if (resumeToken) {
      acc.resumeToken = resumeToken;
      return acc;
    }
    const tabName = stringArg(argument, "--tab=");
    if (tabName) {
      acc.tabName = tabName;
      return acc;
    }
    const requestId = stringArg(argument, "--request-id=");
    if (requestId) {
      acc.requestId = requestId;
      return acc;
    }
    return acc;
  }, defaults);
};

type SheetSerialRow = {
  deviceId: string;
  serial: string;
  rowNumber: number;
  row: Record<string, string | number | null>;
};

export type SerialMapResult = {
  mapping: Map<string, SheetSerialRow>;
  missingSerialRows: SheetSerialRow[];
  conflicts: string[];
};

const coerceString = (value: TypedRow[keyof TypedRow]): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const lowerKeyRow = (row: TypedRow) =>
  new Map<string, TypedRow[keyof TypedRow]>(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  );

const DEVICE_ID_ALIASES = [
  "deviceid",
  "device_id",
  "device id",
  "legacydeviceid",
  "asset_tag",
  "asset tag",
  "asset",
  "serial",
  "serial number",
  "serial_no",
];

const SERIAL_ALIASES = ["serial", "serial number", "serial_no", "serialno"];

const lookupField = (
  map: Map<string, TypedRow[keyof TypedRow]>,
  aliases: string[]
) => {
  for (const alias of aliases) {
    if (map.has(alias)) {
      return map.get(alias);
    }
  }
  return undefined;
};

export const buildSerialMapping = (rows: TypedRow[]): SerialMapResult => {
  const mapping = new Map<string, SheetSerialRow>();
  const missingSerialRows: SheetSerialRow[] = [];
  const conflicts: string[] = [];
  const serialUsage = new Map<string, string>();

  rows.forEach((row, index) => {
    const normalized = lowerKeyRow(row);
    const legacyId =
      coerceString(lookupField(normalized, DEVICE_ID_ALIASES)) ??
      coerceString(row.deviceId);
    if (!legacyId) {
      conflicts.push(`row ${index + 1}: missing legacy deviceId`);
      return;
    }

    const serialValue =
      coerceString(lookupField(normalized, SERIAL_ALIASES)) ??
      coerceString(row.serial);
    if (!serialValue) {
      missingSerialRows.push({
        deviceId: legacyId,
        serial: "",
        rowNumber: index + 1,
        row: Object.entries(row).reduce<Record<string, string | number | null>>(
          (acc, [key, value]) => {
            acc[key] = typeof value === "object" && value instanceof Date ? value.toISOString() : (value as string | number | null);
            return acc;
          },
          {}
        ),
      });
      return;
    }

    const key = legacyId.trim().toLowerCase();
    const serialKey = serialValue.trim().toLowerCase();
    if (serialUsage.has(serialKey) && serialUsage.get(serialKey) !== key) {
      conflicts.push(
        `row ${index + 1}: serial ${serialValue} already mapped to ${serialUsage.get(serialKey)}`
      );
      return;
    }

    serialUsage.set(serialKey, key);
    mapping.set(key, {
      deviceId: legacyId,
      serial: serialKey,
      rowNumber: index + 1,
      row: Object.entries(row).reduce<Record<string, string | number | null>>(
        (acc, [field, value]) => {
          acc[field] = typeof value === "object" && value instanceof Date ? value.toISOString() : (value as string | number | null);
          return acc;
        },
        {}
      ),
    });
  });

  return { mapping, missingSerialRows, conflicts };
};

export type SerialMigrationReport = {
  dryRun: boolean;
  processed: number;
  updated: number;
  unchanged: number;
  missingMappings: string[];
  missingSerialRows: SheetSerialRow[];
  conflicts: string[];
  rowsAudited: number;
  startedAt: string;
  completedAt: string;
};

export type SerialMigrationOptions = SerialMigrationArgs & {
  sheetId: string;
  tabName: string;
  requestId: string;
  sheetData: FetchSheetDataResult;
};

export const runSerialMigration = async (
  options: SerialMigrationOptions
): Promise<SerialMigrationReport> => {
  const startedAt = Date.now();
  const { mapping, missingSerialRows, conflicts } = buildSerialMapping(options.sheetData.rows);
  const missingMappings: string[] = [];
  const operations: Parameters<typeof DeviceModel.bulkWrite>[0] = [];
  const filter: FilterQuery<DeviceAttributes> = {};
  if (options.resumeToken) {
    filter.deviceId = { $gt: options.resumeToken };
  }

  const devices = await DeviceModel.find(filter).sort({ deviceId: 1 }).exec();
  let updated = 0;
  let unchanged = 0;

  devices.forEach((doc) => {
    const key = doc.deviceId.toLowerCase();
    const mappingEntry = mapping.get(key);
    if (!mappingEntry) {
      missingMappings.push(doc.deviceId);
      return;
    }

    if (doc.serial && doc.serial.toLowerCase() === mappingEntry.serial) {
      unchanged += 1;
      return;
    }

    updated += 1;
    if (!options.dryRun) {
      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              serial: mappingEntry.serial,
              serialMigratedAt: new Date(),
            },
          },
        },
      });
    }
  });

  if (!options.dryRun && operations.length > 0) {
    const batchGroups = [];
    for (let i = 0; i < operations.length; i += options.batchSize) {
      batchGroups.push(operations.slice(i, i + options.batchSize));
    }
    for (const batch of batchGroups) {
      await DeviceModel.bulkWrite(batch, { ordered: false });
    }
  }

  const completedAt = Date.now();

  await SyncEventModel.create({
    eventType: "MIGRATION_RUN",
    route: "scripts/backfill-serial",
    method: "CLI",
    requestId: options.requestId,
    metadata: {
      sheetId: options.sheetId,
      tabName: options.tabName,
      rowsAudited: options.sheetData.rows.length,
      processed: devices.length,
      updated,
      unchanged,
      missingMappings,
      missingSerialCount: missingSerialRows.length,
      conflicts,
      dryRun: options.dryRun,
      resumeToken: options.resumeToken ?? null,
      batchSize: options.batchSize,
      status: options.dryRun ? "dry-run" : "success",
    },
  });

  return {
    dryRun: options.dryRun,
    processed: devices.length,
    updated,
    unchanged,
    missingMappings,
    missingSerialRows,
    conflicts,
    rowsAudited: options.sheetData.rows.length,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
  };
};

const writeReportFiles = async (
  report: SerialMigrationReport,
  options: SerialMigrationOptions
) => {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const safeTimestamp = report.completedAt.replace(/[:.]/g, "-");
  const basePath = path.join(REPORT_DIR, `serial-migration-${safeTimestamp}`);
  const jsonPath = `${basePath}.json`;
  const markdownPath = `${basePath}.md`;

  await fs.writeFile(jsonPath, JSON.stringify({ report, options }, null, 2), "utf-8");

  const markdownSummary = `# Serial Migration Report\n\n` +
    `- Dry Run: ${report.dryRun ? "yes" : "no"}\n` +
    `- Rows Audited: ${report.rowsAudited}\n` +
    `- Devices Processed: ${report.processed}\n` +
    `- Updated: ${report.updated}\n` +
    `- Unchanged: ${report.unchanged}\n` +
    `- Missing Sheet Rows: ${report.missingSerialRows.length}\n` +
    `- Missing Mongo Matches: ${report.missingMappings.length}\n` +
    `- Conflicts: ${report.conflicts.length}\n\n` +
    `## Missing Serial Rows\n` +
    (report.missingSerialRows.length
      ? report.missingSerialRows
          .map(
            (row) =>
              `- Row ${row.rowNumber} (deviceId=${row.deviceId ?? "unknown"}) missing serial`
          )
          .join("\n")
      : "- None") +
    `\n\n## Missing Mongo Matches\n` +
    (report.missingMappings.length
      ? report.missingMappings.map((value) => `- ${value}`).join("\n")
      : "- None") +
    `\n\n## Conflicts\n` +
    (report.conflicts.length ? report.conflicts.map((value) => `- ${value}`).join("\n") : "- None");

  await fs.writeFile(markdownPath, markdownSummary, "utf-8");

  return { jsonPath, markdownPath };
};

const main = async () => {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const runtime = await ensureRuntimeConfig();
  const sheetId = runtime.config.devicesSheetId;
  if (!sheetId) {
    throw new AppError({
      code: "INVALID_SYNC_CONFIGURATION",
      message: "devicesSheetId was not defined. Seed configuration before running the migration.",
    });
  }

  const requestId = cliArgs.requestId ?? randomUUID();
  await connectToDatabase();
  const sheetData = await fetchSheetData({
    sheetId,
    tabName: cliArgs.tabName ?? "Devices",
    requestId,
    includeEmptyRows: true,
  });

  const runOptions: SerialMigrationOptions = {
    ...cliArgs,
    sheetId,
    tabName: cliArgs.tabName ?? sheetData.metrics.tabName,
    requestId,
    sheetData,
  };

  const report = await runSerialMigration(runOptions);
  const files = await writeReportFiles(report, runOptions);

  logger.info(
    {
      event: "SERIAL_MIGRATION_COMPLETE",
      dryRun: report.dryRun,
      processed: report.processed,
      updated: report.updated,
      missingMappings: report.missingMappings.length,
      missingSerialRows: report.missingSerialRows.length,
      conflicts: report.conflicts.length,
      requestId,
      reportFiles: files,
    },
    report.dryRun
      ? "Serial migration dry-run completed"
      : "Serial migration completed and serials updated"
  );
};

void main()
  .catch((error) => {
    const mapped = mapToAppError(error, "UNKNOWN_FAILURE");
    logger.error(
      {
        event: "SERIAL_MIGRATION_FAILED",
        referenceId: mapped.referenceId,
        error,
      },
      mapped.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => undefined);
  });

export default main;
