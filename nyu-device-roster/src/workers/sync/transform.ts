import { createHash } from "node:crypto";

import type { SheetHeader, TypedRow } from "@/lib/google-sheets";
import {
  deviceDocumentSchema,
  type DeviceDocumentSchema,
} from "@/schemas/device";
import { normalizeHeaderKey } from "@/workers/sync/header-map";

type SimpleDeviceField = Exclude<
  keyof Omit<DeviceDocumentSchema, "lastSyncedAt">,
  "offboardingMetadata"
>;

const HEADER_ALIASES: Record<SimpleDeviceField, string[]> = {
  serial: ["serial", "serial number", "serial_no", "serialno"],
  legacyDeviceId: ["deviceid", "device_id", "device id"],
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

const canonicalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const RESERVED_DYNAMIC_KEYS = new Set<string>([
  ...Object.values(HEADER_ALIASES).flat(),
  ...Object.values(OFFBOARDING_METADATA_ALIASES).flat(),
  "deviceid",
  "legacydeviceid",
  "serial",
  "sheetid",
  "assignedto",
  "status",
  "condition",
  "offboardingstatus",
  "lastseen",
  "lastsyncedat",
  "lasttransfernotes",
].map(canonicalizeHeader));

const MAX_DYNAMIC_COLUMNS = 100;

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
    serial: payload.serial.toLowerCase(),
    legacyDeviceId: payload.legacyDeviceId?.toLowerCase() ?? null,
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
    dynamicAttributes: payload.dynamicAttributes
      ? Object.keys(payload.dynamicAttributes)
          .sort()
          .reduce<Record<string, string | number | boolean | null>>((acc, key) => {
            acc[key] = payload.dynamicAttributes?.[key] ?? null;
            return acc;
          }, {})
      : null,
    columnDefinitionsVersion: payload.columnDefinitionsVersion ?? null,
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

const normalizeDynamicValue = (
  value: TypedRow[keyof TypedRow]
): string | number | boolean | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
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
  headers?: SheetHeader[];
  maxDynamicColumns?: number;
  columnDefinitionsVersion?: string;
};

export const normalizeSheetRows = (
  rows: TypedRow[],
  options: NormalizeOptions
): NormalizationResult => {
  const anomalies: string[] = [];
  const devices: NormalizedDevice[] = [];
  const now = options.now ?? new Date();
  const headerLookup = new Map<string, SheetHeader>();
  options.headers?.forEach((header) => {
    headerLookup.set(header.name.toLowerCase(), header);
  });
  const dynamicLimit = options.maxDynamicColumns ?? MAX_DYNAMIC_COLUMNS;

  rows.forEach((row, index) => {
    const rowIdentifier = `row ${index + 1}`;
    const valueMap = toLowerKeyMap(row);

    const legacyDeviceId =
      coerceString(extractField(valueMap, HEADER_ALIASES.legacyDeviceId)) ??
      coerceString(row.deviceId);

    const explicitSerial =
      coerceString(extractField(valueMap, HEADER_ALIASES.serial)) ??
      coerceString(row.serial) ??
      legacyDeviceId;

    if (!explicitSerial) {
      anomalies.push(`${rowIdentifier}: missing serial – row skipped`);
      return;
    }

    const serial = explicitSerial.toLowerCase();

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

    const dynamicAttributeEntries: Array<[
      string,
      string | number | boolean | null,
    ]> = [];
    Object.entries(row).forEach(([columnName, value], columnIndex) => {
      const canonical = canonicalizeHeader(columnName);
      if (!canonical || RESERVED_DYNAMIC_KEYS.has(canonical)) {
        return;
      }
      const lookup = headerLookup.get(columnName.toLowerCase());
      const normalizedKey = lookup?.normalizedName ?? normalizeHeaderKey(columnName, columnIndex + 1);
      const dynamicValue = normalizeDynamicValue(value);
      if (dynamicValue === undefined) {
        return;
      }
      dynamicAttributeEntries.push([normalizedKey, dynamicValue]);
    });

    if (dynamicAttributeEntries.length > dynamicLimit) {
      anomalies.push(
        `${rowIdentifier}: dynamic attribute count ${dynamicAttributeEntries.length} exceeds limit ${dynamicLimit}`
      );
      dynamicAttributeEntries.length = dynamicLimit;
    }

    const dynamicAttributes = dynamicAttributeEntries.reduce<Record<string, string | number | boolean | null>>(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {}
    );

    const payload: DeviceDocumentSchema = {
      serial,
      legacyDeviceId: legacyDeviceId ?? undefined,
      sheetId: options.sheetId,
      assignedTo,
      status,
      condition,
      offboardingStatus: offboardingStatus ?? undefined,
      lastSeen,
      offboardingMetadata,
      lastTransferNotes,
      lastSyncedAt: now,
      dynamicAttributes: Object.keys(dynamicAttributes).length ? dynamicAttributes : undefined,
      columnDefinitionsVersion: options.columnDefinitionsVersion,
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
