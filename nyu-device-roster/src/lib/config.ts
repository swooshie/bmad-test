import { configSchema, type ConfigSchema } from "@/schemas/config";
import ConfigModel, { type AllowlistChangeSource } from "@/models/Config";
import connectToDatabase from "@/lib/db";
import {
  loadAllSecrets,
  SecretProviderError,
  type RuntimeSecrets,
} from "@/lib/secrets";
import { logConfigValidationFailure, logSecretManagerAlert } from "@/lib/logging";
import { recordConfigValidationEvent } from "@/lib/audit/syncEvents";

const CACHE_TTL_MS = 30_000;
const RUNTIME_CACHE_TTL_MS = 30_000;

type CachedConfig = {
  value: ConfigSchema | null;
  fetchedAt: number;
};

let cachedConfig: CachedConfig = { value: null, fetchedAt: 0 };
let cachedRuntimeConfig: { value: RuntimeConfig | null; fetchedAt: number } = {
  value: null,
  fetchedAt: 0,
};

export class RuntimeConfigError extends Error {
  constructor(message: string, public readonly code: "CONFIG_MISSING") {
    super(message);
    this.name = "RuntimeConfigError";
  }
}

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

export type AllowlistDiff = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

export async function upsertConfig(options: {
  allowlist: string[];
  devicesSheetId: string;
  collectionName: string;
  operatorId: string;
  source: AllowlistChangeSource;
}): Promise<{ config: ConfigSchema; diff: AllowlistDiff }> {
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
  const unchanged = normalizedAllowlist.filter((email) => previousAllowlist.includes(email));

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

  const parsedConfig = configSchema.parse({
    ...document,
    lastUpdatedAt: new Date(document.lastUpdatedAt),
    changes: (document.changes ?? []).map((change) => ({
      ...change,
      timestamp: new Date(change.timestamp),
    })),
  });
  return {
    config: parsedConfig,
    diff: {
      added: emailsAdded,
      removed: emailsRemoved,
      unchanged,
    },
  };
}

export function resetConfigCache() {
  cachedConfig = { value: null, fetchedAt: 0 };
}

export default loadConfig;

export type RuntimeConfig = {
  config: ConfigSchema;
  secrets: RuntimeSecrets;
};

const buildRuntimeConfig = async (forceRefresh: boolean): Promise<RuntimeConfig> => {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedRuntimeConfig.value &&
    now - cachedRuntimeConfig.fetchedAt < RUNTIME_CACHE_TTL_MS
  ) {
    return cachedRuntimeConfig.value;
  }

  const config = await loadConfig(forceRefresh);
  if (!config) {
    throw new RuntimeConfigError(
      "Configuration document is missing. Ensure Story A1 seeded the config collection.",
      "CONFIG_MISSING"
    );
  }

  const secrets = await loadAllSecrets({ forceRefresh });
  const runtimeConfig: RuntimeConfig = {
    config,
    secrets,
  };

  cachedRuntimeConfig = { value: runtimeConfig, fetchedAt: now };
  return runtimeConfig;
};

const handleRuntimeConfigFailure = async (error: unknown) => {
  const reason =
    error instanceof Error ? error.message : "Unknown runtime configuration error";
  const metadata: Record<string, unknown> = {
    name: error instanceof Error ? error.name : "UnknownError",
  };

  if (error instanceof SecretProviderError) {
    metadata.secretKey = error.secretKey;
    logSecretManagerAlert({
      event: "SECRET_MANAGER_FAILURE",
      secretKey: error.secretKey,
      reason,
    });
  } else {
    logConfigValidationFailure({ reason, metadata });
  }

  await recordConfigValidationEvent({ reason, metadata });
};

export const loadRuntimeConfig = async (options?: {
  forceRefresh?: boolean;
}): Promise<RuntimeConfig> => buildRuntimeConfig(options?.forceRefresh ?? false);

export const ensureRuntimeConfig = async (options?: {
  forceRefresh?: boolean;
}): Promise<RuntimeConfig> => {
  try {
    return await buildRuntimeConfig(options?.forceRefresh ?? false);
  } catch (error) {
    await handleRuntimeConfigFailure(error);
    throw error;
  }
};

export const resetRuntimeConfigCache = () => {
  cachedRuntimeConfig = { value: null, fetchedAt: 0 };
};
