import { createHash } from "node:crypto";

import type { TypedRow } from "@/lib/google-sheets";
import {
  deviceDocumentSchema,
  type DeviceDocumentSchema,
} from "@/schemas/device";

const HEADER_ALIASES: Record<
  keyof Omit<DeviceDocumentSchema, "lastSyncedAt">,
  string[]
> = {
  deviceId: ["deviceid", "device_id", "device id"],
  sheetId: ["sheetid", "sheet_id", "sheet id"],
  assignedTo: ["assignedto", "assigned_to", "assigned to"],
  status: ["status"],
  condition: ["condition"],
  offboardingStatus: ["offboardingstatus", "offboarding_status", "offboarding status"],
  lastSeen: ["lastseen", "last_seen", "last seen"],
};

const toLowerKeyMap = (row: TypedRow) => {
  const entries = Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]);
  return new Map<string, TypedRow[string]>(entries);
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase().concat(segment.slice(1)) ?? "")
    .join(" ");

const createContentHash = (payload: DeviceDocumentSchema): string => {
  const stablePayload = {
    deviceId: payload.deviceId.toLowerCase(),
    assignedTo: payload.assignedTo.toLowerCase(),
    status: payload.status.toLowerCase(),
    condition: payload.condition.toLowerCase(),
    offboardingStatus: payload.offboardingStatus?.toLowerCase() ?? null,
    lastSeen: payload.lastSeen ? payload.lastSeen.toISOString() : null,
    sheetId: payload.sheetId.toLowerCase(),
  };
  return createHash("sha256").update(JSON.stringify(stablePayload)).digest("hex");
};

const extractField = (
  valueMap: Map<string, TypedRow[keyof TypedRow]>,
  aliases: string[]
): TypedRow[keyof TypedRow] | undefined => {
  for (const alias of aliases) {
    if (valueMap.has(alias)) {
      return valueMap.get(alias);
    }
  }
  return undefined;
};

const coerceString = (value: TypedRow[keyof TypedRow]): string | undefined => {
  if (value === undefined || value === null) return undefined;
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

const normalizeStatus = (value: string | undefined) =>
  value ? titleCase(value) : "Unknown";

const normalizeAssignedTo = (value: string | undefined) =>
  value ?? "Unassigned";

const normalizeCondition = (value: string | undefined) =>
  value ? titleCase(value) : "Unknown";

export type NormalizedDevice = DeviceDocumentSchema & {
  contentHash: string;
};

export type NormalizationResult = {
  devices: NormalizedDevice[];
  anomalies: string[];
  rowCount: number;
  skipped: number;
};

type NormalizeOptions = {
  sheetId: string;
  now?: Date;
};

export const normalizeSheetRows = (
  rows: TypedRow[],
  options: NormalizeOptions
): NormalizationResult => {
  const anomalies: string[] = [];
  const devices: NormalizedDevice[] = [];
  const now = options.now ?? new Date();

  rows.forEach((row, index) => {
    const rowIdentifier = `row ${index + 1}`;
    const valueMap = toLowerKeyMap(row);

    const deviceId =
      coerceString(extractField(valueMap, HEADER_ALIASES.deviceId)) ??
      coerceString(row.deviceId);
    if (!deviceId) {
      anomalies.push(`${rowIdentifier}: missing deviceId – row skipped`);
      return;
    }

    const assignedTo = normalizeAssignedTo(
      coerceString(extractField(valueMap, HEADER_ALIASES.assignedTo)) ??
        coerceString(row.assignedTo)
    );
    const status = normalizeStatus(
      coerceString(extractField(valueMap, HEADER_ALIASES.status)) ??
        coerceString(row.status)
    );
    const condition = normalizeCondition(
      coerceString(extractField(valueMap, HEADER_ALIASES.condition)) ??
        coerceString(row.condition)
    );
    const offboardingStatus =
      coerceString(extractField(valueMap, HEADER_ALIASES.offboardingStatus)) ??
      coerceString(row.offboardingStatus);
    const lastSeenRaw =
      extractField(valueMap, HEADER_ALIASES.lastSeen) ?? row.lastSeen ?? null;

    const lastSeen =
      lastSeenRaw === null || lastSeenRaw === undefined
        ? undefined
        : (() => {
            if (lastSeenRaw instanceof Date) {
              return Number.isNaN(lastSeenRaw.getTime()) ? undefined : lastSeenRaw;
            }
            const candidate = new Date(
              typeof lastSeenRaw === "number" ? lastSeenRaw : String(lastSeenRaw)
            );
            return Number.isNaN(candidate.getTime()) ? undefined : candidate;
          })();

    const payload: DeviceDocumentSchema = {
      deviceId,
      sheetId: options.sheetId,
      assignedTo,
      status,
      condition,
      offboardingStatus: offboardingStatus ?? undefined,
      lastSeen,
      lastSyncedAt: now,
    };

    const parsed = deviceDocumentSchema.safeParse(payload);
    if (!parsed.success) {
      anomalies.push(
        `${rowIdentifier}: ${parsed.error.flatten().formErrors.join(", ")}`
      );
      return;
    }

    devices.push({
      ...parsed.data,
      contentHash: createContentHash(parsed.data),
    });
  });

  return {
    devices,
    anomalies,
    rowCount: rows.length,
    skipped: rows.length - devices.length,
  };
};
