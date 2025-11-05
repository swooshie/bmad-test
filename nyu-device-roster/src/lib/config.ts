import { configSchema, type ConfigSchema } from "@/schemas/config";
import ConfigModel, { type AllowlistChangeSource } from "@/models/Config";
import connectToDatabase from "@/lib/db";

const CACHE_TTL_MS = 30_000;

type CachedConfig = {
  value: ConfigSchema | null;
  fetchedAt: number;
};

let cachedConfig: CachedConfig = { value: null, fetchedAt: 0 };

export async function loadConfig(forceRefresh = false): Promise<ConfigSchema | null> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig.value && now - cachedConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  await connectToDatabase();
  const document = await ConfigModel.findOne().lean();

  if (!document) {
    cachedConfig = { value: null, fetchedAt: now };
    return null;
  }

  const parsed = configSchema.parse({
    ...document,
    lastUpdatedAt: new Date(document.lastUpdatedAt),
    changes: (document.changes ?? []).map((change) => ({
      ...change,
      timestamp: new Date(change.timestamp),
    })),
  });
  cachedConfig = { value: parsed, fetchedAt: now };
  return parsed;
}

export async function upsertConfig(options: {
  allowlist: string[];
  devicesSheetId: string;
  collectionName: string;
  operatorId: string;
  source: AllowlistChangeSource;
}): Promise<ConfigSchema> {
  const { allowlist, collectionName, devicesSheetId, operatorId, source } = options;

  const normalizedAllowlist = Array.from(
    new Set(
      allowlist.map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0)
    )
  ).sort();

  await connectToDatabase();

  const existing = await ConfigModel.findOne().lean();

  const previousAllowlist = existing?.allowlist ?? [];
  const emailsAdded = normalizedAllowlist.filter((email) => !previousAllowlist.includes(email));
  const emailsRemoved = previousAllowlist.filter((email) => !normalizedAllowlist.includes(email));

  const now = new Date();
  const update = {
    $set: {
      allowlist: normalizedAllowlist,
      devicesSheetId,
      collectionName,
      lastUpdatedAt: now,
      updatedBy: operatorId,
    },
    $push: {
      changes: {
        operatorId,
        timestamp: now,
        emailsAdded,
        emailsRemoved,
        source,
      },
    },
  };

  const document = await ConfigModel.findOneAndUpdate(
    {},
    update,
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  cachedConfig = { value: null, fetchedAt: 0 };

  if (!document) {
    throw new Error("Failed to upsert configuration");
  }

  return configSchema.parse({
    ...document,
    lastUpdatedAt: new Date(document.lastUpdatedAt),
    changes: (document.changes ?? []).map((change) => ({
      ...change,
      timestamp: new Date(change.timestamp),
    })),
  });
}

export function resetConfigCache() {
  cachedConfig = { value: null, fetchedAt: 0 };
}

export default loadConfig;
