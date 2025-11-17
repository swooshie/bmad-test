import { createHash } from "node:crypto";

import type { TypedRow } from "@/lib/google-sheets";
import {
  deviceDocumentSchema,
  type DeviceDocumentSchema,
} from "@/schemas/device";

type SimpleDeviceField = Exclude<
  keyof Omit<DeviceDocumentSchema, "lastSyncedAt">,
  "offboardingMetadata"
>;

const HEADER_ALIASES: Record<SimpleDeviceField, string[]> = {
  deviceId: ["deviceid", "device_id", "device id"],
  sheetId: ["sheetid", "sheet_id", "sheet id"],
  assignedTo: ["assignedto", "assigned_to", "assigned to"],
  status: ["status"],
  condition: ["condition"],
  offboardingStatus: ["offboardingstatus", "offboarding_status", "offboarding status"],
  lastSeen: ["lastseen", "last_seen", "last seen"],
  lastTransferNotes: ["lasttransfernotes", "last_transfer_notes", "last transfer notes"],
};

const OFFBOARDING_METADATA_ALIASES = {
  lastActor: ["offboardingactor", "offboarding_actor", "offboarding actor", "transfer actor"],
  lastAction: ["offboardingaction", "offboarding_action", "offboarding action", "transfer action"],
  lastTransferAt: [
    "offboardingtimestamp",
    "offboarding_timestamp",
    "offboarding timestamp",
    "transfer timestamp",
  ],
} as const;

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
    lastTransferNotes: payload.lastTransferNotes?.toLowerCase() ?? null,
    lastSeen: payload.lastSeen ? payload.lastSeen.toISOString() : null,
    sheetId: payload.sheetId.toLowerCase(),
    offboardingMetadata: payload.offboardingMetadata
      ? {
          lastActor: payload.offboardingMetadata.lastActor?.toLowerCase() ?? null,
          lastAction: payload.offboardingMetadata.lastAction?.toLowerCase() ?? null,
          lastTransferAt: payload.offboardingMetadata.lastTransferAt
            ? payload.offboardingMetadata.lastTransferAt.toISOString()
            : null,
        }
      : null,
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

const coerceDate = (value: TypedRow[keyof TypedRow] | undefined | null): Date | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const candidate = new Date(typeof value === "number" ? value : String(value));
  return Number.isNaN(candidate.getTime()) ? undefined : candidate;
};

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

    const lastSeen = coerceDate(lastSeenRaw);
    const lastTransferNotes =
      coerceString(extractField(valueMap, HEADER_ALIASES.lastTransferNotes)) ??
      coerceString(row.lastTransferNotes);

    const offboardingActor =
      coerceString(extractField(valueMap, OFFBOARDING_METADATA_ALIASES.lastActor)) ??
      coerceString(row.offboardingActor);
    const offboardingAction =
      coerceString(extractField(valueMap, OFFBOARDING_METADATA_ALIASES.lastAction)) ??
      coerceString(row.offboardingAction);
    const offboardingTimestampRaw =
      extractField(valueMap, OFFBOARDING_METADATA_ALIASES.lastTransferAt) ??
      row.offboardingTimestamp;
    const offboardingMetadata =
      offboardingActor || offboardingAction || offboardingTimestampRaw
        ? {
            lastActor: offboardingActor,
            lastAction: offboardingAction,
            lastTransferAt: coerceDate(offboardingTimestampRaw),
          }
        : undefined;

    const payload: DeviceDocumentSchema = {
      deviceId,
      sheetId: options.sheetId,
      assignedTo,
      status,
      condition,
      offboardingStatus: offboardingStatus ?? undefined,
      lastSeen,
      offboardingMetadata,
      lastTransferNotes,
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
