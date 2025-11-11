#!/usr/bin/env node
import "tsconfig-paths/register.js";
import path from "path";
import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv();

import connectToDatabase from "@/lib/db";
import { logger } from "@/lib/logging";
import DeviceModel from "@/models/Device";

async function main() {
  try {
    const connection = await connectToDatabase();
    await DeviceModel.syncIndexes();
    logger.info(
      { event: "DEVICE_INDEX_VERIFY", database: connection.connection.name },
      "Device indexes synchronized"
    );
    await mongoose.connection.close();
  } catch (error) {
    logger.error({ event: "DEVICE_INDEX_VERIFY_FAILED", error }, "Index verification failed");
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

void main();
