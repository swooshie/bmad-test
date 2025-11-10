import { readFileSync, existsSync } from "fs";
import path from "path";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

import { logger } from "@/lib/logging";

const SECRET_CACHE_TTL_MS = 5 * 60 * 1000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 150;

export type SecretKey =
  | "googleClientId"
  | "googleClientSecret"
  | "nextAuthSecret"
  | "mongoUri"
  | "sheetsServiceAccount";

export type SheetsServiceAccount = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri?: string;
  token_uri: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
};

type SecretValueMap = {
  googleClientId: string;
  googleClientSecret: string;
  nextAuthSecret: string;
  mongoUri: string;
  sheetsServiceAccount: SheetsServiceAccount;
};

type SecretSpec<TValue> = {
  secretIdEnv: string;
  fallbackEnv?: string;
  parser?: (raw: string) => TValue;
};

const SECRET_SPECS: Record<SecretKey, SecretSpec<SecretValueMap[SecretKey]>> = {
  googleClientId: {
    secretIdEnv: "SECRET_NAME_GOOGLE_CLIENT_ID",
    fallbackEnv: "GOOGLE_CLIENT_ID",
  },
  googleClientSecret: {
    secretIdEnv: "SECRET_NAME_GOOGLE_CLIENT_SECRET",
    fallbackEnv: "GOOGLE_CLIENT_SECRET",
  },
  nextAuthSecret: {
    secretIdEnv: "SECRET_NAME_NEXTAUTH_SECRET",
    fallbackEnv: "NEXTAUTH_SECRET",
  },
  mongoUri: {
    secretIdEnv: "SECRET_NAME_MONGODB_URI",
    fallbackEnv: "MONGODB_URI",
  },
  sheetsServiceAccount: {
    secretIdEnv: "SECRET_NAME_SHEETS_SERVICE_ACCOUNT",
    fallbackEnv: "SHEETS_SERVICE_ACCOUNT_JSON",
    parser: (raw: string) => JSON.parse(raw) as SheetsServiceAccount,
  },
};

type SecretSource = "secret-manager" | "env" | "sample";

type SecretCacheEntry<TValue> = {
  value: TValue;
  fetchedAt: number;
  version: string | null;
  source: SecretSource;
};

const secretCache: Partial<Record<SecretKey, SecretCacheEntry<SecretValueMap[SecretKey]>>> =
  {};

let secretManagerClient: SecretManagerServiceClient | null = null;

const getSecretManagerClient = (): SecretManagerServiceClient => {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  return secretManagerClient;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const appendLatestVersion = (secretName: string): string =>
  secretName.includes("/versions/") ? secretName : `${secretName}/versions/latest`;

export class SecretProviderError extends Error {
  constructor(
    public readonly secretKey: SecretKey,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SecretProviderError";
  }
}

export class SecretNotConfiguredError extends SecretProviderError {
  constructor(secretKey: SecretKey, expectedEnv: string) {
    super(
      secretKey,
      `Secret "${secretKey}" is not configured. Set ${expectedEnv} with the Secret Manager resource name.`
    );
    this.name = "SecretNotConfiguredError";
  }
}

const readSecretFromSecretManager = async <TValue>(
  secretKey: SecretKey,
  secretName: string,
  parser?: (raw: string) => TValue
): Promise<{ value: TValue; version: string | null }> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < RETRY_ATTEMPTS) {
    try {
      const [accessResponse] = await getSecretManagerClient().accessSecretVersion({
        name: appendLatestVersion(secretName),
      });

      const payloadBuffer = accessResponse.payload?.data;
      if (!payloadBuffer) {
        throw new SecretProviderError(secretKey, "Secret payload was empty");
      }

      const raw = payloadBuffer.toString("utf8");
      const parsed = parser ? parser(raw) : (raw as TValue);
      const version = accessResponse.name?.split("/").pop() ?? null;

      return { value: parsed, version };
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= RETRY_ATTEMPTS) {
        throw new SecretProviderError(
          secretKey,
          `Failed to access Secret Manager resource "${secretName}" after ${RETRY_ATTEMPTS} attempts`,
          error
        );
      }
      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw new SecretProviderError(
    secretKey,
    `Failed to access Secret Manager resource "${secretName}"`,
    lastError
  );
};

const DEFAULT_SHEETS_SAMPLE_PATH = path.resolve(
  process.cwd(),
  "config/local-dev/sheets-service-account.sample.json"
);

const readSheetsServiceAccountSample = (): { value: SheetsServiceAccount; path: string } | null => {
  const samplePath =
    process.env.SHEETS_SERVICE_ACCOUNT_SAMPLE_PATH ?? DEFAULT_SHEETS_SAMPLE_PATH;
  if (!existsSync(samplePath)) {
    return null;
  }
  try {
    const file = readFileSync(samplePath, "utf-8");
    return {
      value: JSON.parse(file) as SheetsServiceAccount,
      path: samplePath,
    };
  } catch (error) {
    logger.error(
      { event: "SHEETS_SERVICE_ACCOUNT_SAMPLE_INVALID", path: samplePath, error },
      "Failed to parse sheets service account sample file"
    );
    return null;
  }
};

const readSecretFromEnv = <TValue>(
  secretKey: SecretKey,
  envName: string,
  parser?: (raw: string) => TValue
): { value: TValue; source: SecretSource; version: string | null } => {
  const raw = process.env[envName];
  if (!raw) {
    if (secretKey === "sheetsServiceAccount" && process.env.NODE_ENV !== "production") {
      const sample = readSheetsServiceAccountSample();
      if (sample) {
        logger.warn(
          {
            event: "SHEETS_SERVICE_ACCOUNT_SAMPLE_USED",
            path: sample.path,
          },
          "Using sample sheets service account for local development"
        );
        return {
          value: sample.value as TValue,
          source: "sample",
          version: "sample",
        };
      }
    }
    throw new SecretNotConfiguredError(secretKey, envName);
  }
  logger.warn(
    {
      event: "SECRET_MANAGER_FALLBACK",
      secretKey,
      envName,
    },
    "Falling back to plain environment variable while Secret Manager path is missing"
  );
  return {
    value: parser ? parser(raw) : ((raw as unknown) as TValue),
    source: "env",
    version: "env",
  };
};

const isCacheValid = <TValue>(
  entry?: SecretCacheEntry<TValue>,
  forceRefresh?: boolean
): entry is SecretCacheEntry<TValue> => {
  if (!entry || forceRefresh) {
    return false;
  }
  return Date.now() - entry.fetchedAt < SECRET_CACHE_TTL_MS;
};

const storeInCache = <TValue>(
  secretKey: SecretKey,
  entry: SecretCacheEntry<TValue>
): TValue => {
  secretCache[secretKey] = entry as SecretCacheEntry<SecretValueMap[SecretKey]>;
  return entry.value;
};

const loadSecretValue = async <TKey extends SecretKey>(
  secretKey: TKey,
  options?: { forceRefresh?: boolean }
): Promise<SecretValueMap[TKey]> => {
  const cached = secretCache[secretKey] as SecretCacheEntry<SecretValueMap[TKey]> | undefined;
  if (isCacheValid(cached, options?.forceRefresh)) {
    return cached.value;
  }

  const spec = SECRET_SPECS[secretKey];
  const configuredSecretName = process.env[spec.secretIdEnv];

  if (configuredSecretName) {
    const { value, version } = await readSecretFromSecretManager(
      secretKey,
      configuredSecretName,
      spec.parser
    );
    return storeInCache(secretKey, {
      value,
      version,
      fetchedAt: Date.now(),
      source: "secret-manager",
    });
  }

  if (spec.fallbackEnv) {
    const { value, source, version } = readSecretFromEnv(secretKey, spec.fallbackEnv, spec.parser);
    return storeInCache(secretKey, {
      value,
      version,
      fetchedAt: Date.now(),
      source,
    });
  }

  throw new SecretNotConfiguredError(secretKey, spec.secretIdEnv);
};

export const getGoogleClientId = (options?: { forceRefresh?: boolean }) =>
  loadSecretValue("googleClientId", options);

export const getGoogleClientSecret = (options?: { forceRefresh?: boolean }) =>
  loadSecretValue("googleClientSecret", options);

export const getNextAuthSecret = (options?: { forceRefresh?: boolean }) =>
  loadSecretValue("nextAuthSecret", options);

export const getMongoConnectionUri = (options?: { forceRefresh?: boolean }) =>
  loadSecretValue("mongoUri", options);

export const getSheetsServiceAccount = (options?: { forceRefresh?: boolean }) =>
  loadSecretValue("sheetsServiceAccount", options);

export const loadAllSecrets = async (options?: { forceRefresh?: boolean }) => {
  const entries = await Promise.all(
    (Object.keys(SECRET_SPECS) as SecretKey[]).map(async (key) => {
      const value = await loadSecretValue(key, options);
      return [key, value] as const;
    })
  );

  return Object.fromEntries(entries) as SecretValueMap;
};

export const invalidateSecretCache = (secretKey?: SecretKey) => {
  if (secretKey) {
    delete secretCache[secretKey];
    return;
  }
  (Object.keys(secretCache) as SecretKey[]).forEach((key) => {
    delete secretCache[key];
  });
};

export const __resetSecretManagerClientForTests = () => {
  secretManagerClient = null;
  invalidateSecretCache();
};

export type RuntimeSecrets = SecretValueMap;
