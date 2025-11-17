import type { FilterQuery, SortOrder } from "mongoose";

import connectToDatabase from "@/lib/db";
import DeviceModel, { type DeviceAttributes, type DeviceOffboardingMetadata } from "@/models/Device";
import type {
  DeviceGridQueryFilters,
  DeviceGridQueryState,
  SortDirection,
} from "@/lib/devices/grid-query";
import { deriveGovernanceCue, type GovernanceCue } from "@/lib/governance/cues";

export type SerializedOffboardingMetadata = {
  lastActor?: string | null;
  lastAction?: string | null;
  lastTransferAt?: string | null;
};

export type DeviceGridDevice = {
  deviceId: string;
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
  filterOptions: {
    statuses: string[];
    conditions: string[];
    offboardingStatuses: string[];
  };
};

export type DeviceGridResult = {
  devices: DeviceGridDevice[];
  meta: DeviceGridMeta;
};

const buildFilter = (state: DeviceGridQueryState): FilterQuery<DeviceAttributes> => {
  const filter: FilterQuery<DeviceAttributes> = {};
  const { filters } = state;

  if (filters.search) {
    const searchPattern = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ deviceId: searchPattern }, { assignedTo: searchPattern }, { status: searchPattern }];
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

  return {
    deviceId: doc.deviceId,
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
  };
};

export const queryDeviceGrid = async (state: DeviceGridQueryState): Promise<DeviceGridResult> => {
  await connectToDatabase();
  const filter = buildFilter(state);
  const sort = buildSort(state);
  const skip = (state.page - 1) * state.pageSize;

  const [records, total, statuses, conditions, offboardingStatuses] = await Promise.all([
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
  ]);

  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / state.pageSize));

  return {
    devices: records.map(serializeDevice),
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
