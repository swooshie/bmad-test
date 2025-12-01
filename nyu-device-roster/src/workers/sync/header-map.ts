import { createHash } from "node:crypto";

import type { SheetHeader, TypedRow, TypedCellValue } from "@/lib/google-sheets";
import type { ColumnDataType } from "@/models/ColumnDefinition";

export type HeaderRegistryEntry = {
  key: string;
  label: string;
  displayOrder: number;
  dataType: ColumnDataType;
  nullable: boolean;
};

export type HeaderDiff = {
  added: HeaderRegistryEntry[];
  removed: HeaderRegistryEntry[];
  unchanged: HeaderRegistryEntry[];
  renamed: Array<{ from: HeaderRegistryEntry; to: HeaderRegistryEntry }>;
};

const HEADER_KEY_REGEX = /[^a-z0-9]+/g;

export const normalizeHeaderKey = (label: string, fallbackIndex: number): string => {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(HEADER_KEY_REGEX, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length > 0 ? slug : `column_${fallbackIndex}`;
};

const COLUMN_SAMPLE_LIMIT = 32;

const inferColumnProfile = (
  header: SheetHeader,
  rows?: TypedRow[]
): Pick<HeaderRegistryEntry, "dataType" | "nullable"> => {
  if (!rows?.length) {
    return { dataType: "unknown", nullable: true };
  }
  const samples: TypedCellValue[] = [];
  let nullable = false;

  for (const row of rows) {
    const raw = row[header.name as keyof TypedRow] as TypedCellValue | undefined;
    if (raw === undefined || raw === null || raw === "") {
      nullable = true;
      continue;
    }
    samples.push(raw);
    if (samples.length >= COLUMN_SAMPLE_LIMIT) {
      break;
    }
  }

  if (samples.length === 0) {
    return { dataType: "unknown", nullable: true };
  }

  const detected: Set<ColumnDataType> = new Set();
  samples.forEach((value) => {
    if (typeof value === "number") {
      detected.add("number");
      return;
    }
    if (typeof value === "boolean") {
      detected.add("boolean");
      return;
    }
    if (value instanceof Date) {
      detected.add("date");
      return;
    }
    detected.add("string");
  });

  if (detected.has("date")) {
    return { dataType: "date", nullable };
  }
  if (detected.has("number") && detected.size === 1) {
    return { dataType: "number", nullable };
  }
  if (detected.has("boolean") && detected.size === 1) {
    return { dataType: "boolean", nullable };
  }
  if (detected.has("number") && detected.size === 2 && detected.has("string")) {
    return { dataType: "string", nullable };
  }
  if (detected.has("string")) {
    return { dataType: "string", nullable };
  }
  return { dataType: "unknown", nullable };
};

export const buildHeaderRegistry = (
  headers: SheetHeader[],
  rows?: TypedRow[]
): HeaderRegistryEntry[] =>
  headers.map((header, index) => {
    const profile = inferColumnProfile(header, rows);
    return {
      key: normalizeHeaderKey(header.name, index + 1),
      label: header.name,
      displayOrder: header.position ?? index,
      dataType: profile.dataType,
      nullable: profile.nullable,
    };
  });

export const diffHeaderRegistry = (
  current: HeaderRegistryEntry[],
  previous: HeaderRegistryEntry[]
): HeaderDiff => {
  const currentMap = new Map(current.map((entry) => [entry.key, entry]));
  const previousMap = new Map(previous.map((entry) => [entry.key, entry]));

  const added: HeaderRegistryEntry[] = [];
  const removed: HeaderRegistryEntry[] = [];
  const unchanged: HeaderRegistryEntry[] = [];
  const renamed: Array<{ from: HeaderRegistryEntry; to: HeaderRegistryEntry }> = [];

  current.forEach((entry) => {
    if (previousMap.has(entry.key)) {
      unchanged.push(entry);
    } else {
      added.push(entry);
    }
  });

  previous.forEach((entry) => {
    if (!currentMap.has(entry.key)) {
      removed.push(entry);
    }
  });

  // Heuristic rename detection: pair entries with matching displayOrder to avoid double-counting
  const removedByOrder = new Map(removed.map((entry) => [entry.displayOrder, entry]));
  const filteredAdded: HeaderRegistryEntry[] = [];
  added.forEach((entry) => {
    const match = removedByOrder.get(entry.displayOrder);
    if (match) {
      renamed.push({ from: match, to: entry });
      removedByOrder.delete(entry.displayOrder);
      return;
    }
    filteredAdded.push(entry);
  });

  const filteredRemoved = Array.from(removedByOrder.values());

  return { added: filteredAdded, removed: filteredRemoved, unchanged, renamed };
};

export const deriveRegistryVersion = (entries: HeaderRegistryEntry[]): string => {
  if (!entries.length) {
    return "registry-empty";
  }
  const hash = createHash("sha1");
  entries
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .forEach((entry) => {
      hash.update(`${entry.key}:${entry.label}:${entry.dataType}:${entry.nullable}`);
    });
  return `registry-${entries.length}-${hash.digest("hex")}`;
};
