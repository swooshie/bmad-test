#!/usr/bin/env node
import "tsconfig-paths/register.js";
import { readFileSync } from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv();

import { upsertConfig, resetConfigCache } from "@/lib/config";
import { logger } from "@/lib/logging";

type SeedOptions = {
  emails: string[];
  devicesSheetId: string;
  collectionName: string;
  operatorId: string;
  source: "cli" | "admin-endpoint";
};

type Argv = string[];

const HELP_TEXT = `Usage: ts-node scripts/seed-allowlist.ts --emails <csv> --sheet <sheet-id> --collection <collection-name> --operator <operator-id> [--source cli|admin-endpoint]

Options:
  --emails        Comma-separated list of manager email addresses to allow.
  --emails-file   Path to a newline-delimited file of emails (can be used with --emails).
  --sheet         Google Sheets identifier for the devices roster.
  --collection    MongoDB collection name backing the roster.
  --operator      Operator identifier to attribute the change.
  --source        Origin of the change (cli | admin-endpoint). Defaults to cli.
`;

function parseArguments(argv: Argv): SeedOptions {
  const options: Partial<SeedOptions> & { emailsFile?: string } = { source: "cli" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--emails":
        if (!next) throw new Error("--emails flag requires a value");
        options.emails = next.split(",").map((value) => value.trim()).filter(Boolean);
        index += 1;
        break;
      case "--emails-file":
        if (!next) throw new Error("--emails-file flag requires a value");
        options.emailsFile = next;
        index += 1;
        break;
      case "--sheet":
        if (!next) throw new Error("--sheet flag requires a value");
        options.devicesSheetId = next;
        index += 1;
        break;
      case "--collection":
        if (!next) throw new Error("--collection flag requires a value");
        options.collectionName = next;
        index += 1;
        break;
      case "--operator":
        if (!next) throw new Error("--operator flag requires a value");
        options.operatorId = next;
        index += 1;
        break;
      case "--source":
        if (!next) throw new Error("--source flag requires a value");
        if (next !== "cli" && next !== "admin-endpoint") {
          throw new Error("--source must be either 'cli' or 'admin-endpoint'");
        }
        options.source = next;
        index += 1;
        break;
      case "--help":
      case "-h":
        console.log(HELP_TEXT);
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
    }
  }

  const emailSet = new Set(options.emails ?? []);
  if (options.emailsFile) {
    const fileContents = readFileSync(options.emailsFile, "utf-8");
    fileContents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((email) => emailSet.add(email));
  }

  const emails = Array.from(emailSet);

  if (emails.length === 0) {
    throw new Error("At least one email must be provided via --emails or --emails-file");
  }

  if (!options.devicesSheetId) {
    throw new Error("--sheet is required");
  }

  if (!options.collectionName) {
    throw new Error("--collection is required");
  }

  if (!options.operatorId) {
    throw new Error("--operator is required");
  }

  return {
    emails,
    devicesSheetId: options.devicesSheetId,
    collectionName: options.collectionName,
    operatorId: options.operatorId,
    source: options.source ?? "cli",
  };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const options = parseArguments(args);

    const { config, diff } = await upsertConfig({
      allowlist: options.emails,
      devicesSheetId: options.devicesSheetId,
      collectionName: options.collectionName,
      operatorId: options.operatorId,
      source: options.source,
    });

    logger.info(
      {
        event: "ALLOWLIST_SEEDED",
        operatorId: options.operatorId,
        allowlistCount: config.allowlist.length,
        devicesSheetId: config.devicesSheetId,
        collectionName: config.collectionName,
        lastUpdatedAt: config.lastUpdatedAt.toISOString(),
        diff,
      },
      "Allowlist configuration updated"
    );

    resetConfigCache();
  } catch (error) {
    logger.error({ event: "ALLOWLIST_SEED_FAILED", error }, "Failed to seed allowlist");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

void main();
