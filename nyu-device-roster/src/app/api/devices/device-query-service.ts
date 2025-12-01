import { createHash } from "node:crypto";

import type { FilterQuery, SortOrder } from "mongoose";

import connectToDatabase from "@/lib/db";
import DeviceModel, { type DeviceAttributes, type DeviceOffboardingMetadata } from "@/models/Device";
import ColumnDefinitionModel, {
  type ColumnDefinitionAttributes,
} from "@/models/ColumnDefinition";
import type {
  DeviceGridQueryFilters,
  DeviceGridQueryState,
  SortDirection,
} from "@/lib/devices/grid-query";
import { deriveGovernanceCue, type GovernanceCue } from "@/lib/governance/cues";
import {
  DEVICE_COLUMNS,
  DEVICE_COLUMNS_VERSION,
  type DeviceColumn,
} from "@/lib/devices/columns";
import { ensureRuntimeConfig } from "@/lib/config";

export type SerializedOffboardingMetadata = {
  lastActor?: string | null;
  lastAction?: string | null;
  lastTransferAt?: string | null;
};

export type DeviceGridDevice = {
  serial: string;
  legacyDeviceId: string | null;
  sheetId: string;
  assignedTo: string;
  status: string;
  condition: string;
  offboardingStatus: string | null;
  lastSeen: string | null;
  lastSyncedAt: string;
  governanceCue: GovernanceCue;
  lastTransferNotes: string | null;
  offboardingMetadata?: SerializedOffboardingMetadata;
  dynamicAttributes?: Record<string, string | number | boolean | null>;
  columnDefinitionsVersion?: string | null;
};

export type DeviceGridMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  appliedFilters: DeviceGridQueryFilters;
  sort: {
    by: DeviceGridQueryState["sortBy"];
    direction: SortDirection;
  };
  columnsVersion: string;
  filterOptions: {
    statuses: string[];
    conditions: string[];
    offboardingStatuses: string[];
  };
};

export type DeviceGridResult = {
  devices: DeviceGridDevice[];
  columns: DeviceColumn[];
  meta: DeviceGridMeta;
};

const buildFilter = (state: DeviceGridQueryState): FilterQuery<DeviceAttributes> => {
  const filter: FilterQuery<DeviceAttributes> = {};
  const { filters } = state;

  if (filters.search) {
    const searchPattern = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { serial: searchPattern },
      { legacyDeviceId: searchPattern },
      { assignedTo: searchPattern },
      { status: searchPattern },
    ];
  }

  if (filters.status?.length) {
    filter.status = { $in: filters.status };
  }

  if (filters.condition?.length) {
    filter.condition = { $in: filters.condition };
  }

  if (filters.offboardingStatus?.length) {
    filter.offboardingStatus = { $in: filters.offboardingStatus };
  }

  if (filters.assignedTo) {
    filter.assignedTo = new RegExp(filters.assignedTo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }

  return filter;
};

const buildSort = (state: DeviceGridQueryState): Record<string, SortOrder> => ({
  [state.sortBy]: state.sortDirection === "desc" ? -1 : 1,
});

const serializeOffboardingMetadata = (
  metadata?: DeviceOffboardingMetadata
): SerializedOffboardingMetadata | undefined => {
  if (!metadata) {
    return undefined;
  }
  return {
    lastActor: metadata.lastActor ?? null,
    lastAction: metadata.lastAction ?? null,
    lastTransferAt: metadata.lastTransferAt ? metadata.lastTransferAt.toISOString() : null,
  };
};

const serializeDevice = (doc: DeviceAttributes): DeviceGridDevice => {
  const governanceCue = deriveGovernanceCue({
    offboardingStatus: doc.offboardingStatus ?? null,
    condition: doc.condition,
  });
  const dynamicAttributes = doc.dynamicAttributes
    ? doc.dynamicAttributes instanceof Map
      ? Object.fromEntries(doc.dynamicAttributes.entries())
      : doc.dynamicAttributes
    : undefined;

  return {
    serial: doc.serial,
    legacyDeviceId: doc.legacyDeviceId ?? null,
    sheetId: doc.sheetId,
    assignedTo: doc.assignedTo,
    status: doc.status,
    condition: doc.condition,
    offboardingStatus: doc.offboardingStatus ?? null,
    lastSeen: doc.lastSeen ? new Date(doc.lastSeen).toISOString() : null,
    lastSyncedAt: doc.lastSyncedAt ? new Date(doc.lastSyncedAt).toISOString() : new Date().toISOString(),
    governanceCue,
    lastTransferNotes: doc.lastTransferNotes ?? null,
    offboardingMetadata: serializeOffboardingMetadata(doc.offboardingMetadata),
    dynamicAttributes,
    columnDefinitionsVersion: doc.columnDefinitionsVersion ?? null,
  };
};

const deriveRegistryVersion = (registry: ColumnDefinitionAttributes[]): string => {
  const versions = Array.from(
    new Set(
      registry
        .map((entry) => entry.sourceVersion)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
  if (versions.length === 0) {
    return DEVICE_COLUMNS_VERSION;
  }
  if (versions.length === 1) {
    return versions[0];
  }
  const hash = createHash("sha1");
  versions.sort().forEach((value) => hash.update(value));
  return `mixed-${hash.digest("hex")}`;
};

export const buildDynamicColumns = (
  registry: ColumnDefinitionAttributes[]
): { columns: DeviceColumn[]; version: string } => {
  if (registry.length === 0) {
    return {
      columns: [...DEVICE_COLUMNS].sort((a, b) => a.order - b.order),
      version: DEVICE_COLUMNS_VERSION,
    };
  }

  const baseColumnIds = new Set(DEVICE_COLUMNS.map((column) => column.id));
  const dynamicColumns: DeviceColumn[] = registry
    .filter((entry) => !baseColumnIds.has(entry.columnKey))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((entry) => ({
      id: entry.columnKey,
      label: entry.label,
      minWidth: 140,
      visible: false,
      dataType: entry.dataType,
      nullable: entry.nullable,
      numeric: entry.dataType === "number",
      order: DEVICE_COLUMNS.length + entry.displayOrder,
      source: "dynamic",
      governance: {
        anonymized: true,
      },
    }));

  return {
    columns: [...DEVICE_COLUMNS, ...dynamicColumns].sort((a, b) => a.order - b.order),
    version: deriveRegistryVersion(registry),
  };
};

export const queryDeviceGrid = async (state: DeviceGridQueryState): Promise<DeviceGridResult> => {
  await connectToDatabase();
  const runtime = await ensureRuntimeConfig().catch(() => null);
  const sheetId = runtime?.config.devicesSheetId;
  const filter = buildFilter(state);
  const sort = buildSort(state);
  const skip = (state.page - 1) * state.pageSize;

  const [records, total, statuses, conditions, offboardingStatuses, registryDefinitions] = await Promise.all([
    DeviceModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(state.pageSize)
      .lean<DeviceAttributes>()
      .exec(),
    DeviceModel.countDocuments(filter).exec(),
    DeviceModel.distinct("status").exec(),
    DeviceModel.distinct("condition").exec(),
    DeviceModel.distinct("offboardingStatus").exec(),
    sheetId
      ? ColumnDefinitionModel.find({ sheetId, removedAt: null })
          .sort({ displayOrder: 1 })
          .lean<ColumnDefinitionAttributes[]>()
      : Promise.resolve<ColumnDefinitionAttributes[]>([]),
  ]);

  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / state.pageSize));
  const { columns, version } = buildDynamicColumns(registryDefinitions);

  return {
    devices: records.map(serializeDevice),
    columns,
    meta: {
      page: state.page,
      pageSize: state.pageSize,
      total,
      totalPages,
      hasNextPage: state.page < totalPages,
      hasPreviousPage: state.page > 1,
      appliedFilters: state.filters,
      sort: {
        by: state.sortBy,
        direction: state.sortDirection,
      },
      columnsVersion: version,
      filterOptions: {
        statuses: statuses.filter((status): status is string => typeof status === "string"),
        conditions: conditions.filter((condition): condition is string => typeof condition === "string"),
        offboardingStatuses: offboardingStatuses
          .filter((value): value is string => typeof value === "string")
          .filter((value) => value.trim().length > 0),
      },
    },
  };
};

export const __private__ = {
  buildFilter,
  buildSort,
  serializeDevice,
};
