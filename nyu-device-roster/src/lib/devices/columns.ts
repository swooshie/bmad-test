export type DeviceColumnId = string;

export type DeviceColumnDataType = "string" | "number" | "boolean" | "date" | "null" | "unknown";

export type DeviceColumnGovernance = {
  anonymized?: boolean;
  pii?: boolean;
};

export type DeviceColumnSource = "core" | "dynamic";

export type DeviceColumn = {
  id: DeviceColumnId;
  label: string;
  description?: string;
  numeric?: boolean;
  minWidth?: number;
  visible?: boolean;
  dataType: DeviceColumnDataType;
  nullable?: boolean;
  order: number;
  source: DeviceColumnSource;
  governance?: DeviceColumnGovernance;
};

export const DEVICE_COLUMNS_VERSION = "serial-grid-v1";

export const DEVICE_COLUMNS: DeviceColumn[] = [
  {
    id: "serial",
    label: "Serial",
    description: "Canonical identifier",
    minWidth: 160,
    visible: true,
    dataType: "string",
    nullable: false,
    order: 0,
    source: "core",
  },
  {
    id: "legacyDeviceId",
    label: "Legacy Device ID",
    description: "Deprecated identifier retained for reference",
    minWidth: 180,
    visible: false,
    dataType: "string",
    nullable: true,
    order: 1,
    source: "core",
  },
  {
    id: "assignedTo",
    label: "Assigned To",
    description: "Current owner",
    minWidth: 160,
    visible: true,
    dataType: "string",
    nullable: false,
    order: 2,
    source: "core",
    governance: {
      anonymized: true,
      pii: true,
    },
  },
  {
    id: "status",
    label: "Status",
    description: "Roster status",
    minWidth: 120,
    visible: true,
    dataType: "string",
    nullable: false,
    order: 3,
    source: "core",
  },
  {
    id: "condition",
    label: "Condition",
    description: "Hardware condition",
    minWidth: 140,
    visible: true,
    dataType: "string",
    nullable: false,
    order: 4,
    source: "core",
  },
  {
    id: "offboardingStatus",
    label: "Offboarding",
    description: "Offboarding tracker",
    minWidth: 140,
    visible: true,
    dataType: "string",
    nullable: true,
    order: 5,
    source: "core",
  },
  {
    id: "lastSeen",
    label: "Last Seen",
    description: "Last device signal",
    minWidth: 150,
    visible: true,
    dataType: "date",
    nullable: true,
    order: 6,
    source: "core",
  },
  {
    id: "lastSyncedAt",
    label: "Last Synced",
    description: "Last sheet ingest timestamp",
    minWidth: 170,
    visible: true,
    dataType: "date",
    nullable: false,
    order: 7,
    source: "core",
  },
  {
    id: "sheetId",
    label: "Sheet ID",
    description: "Source sheet",
    minWidth: 120,
    visible: false,
    dataType: "string",
    nullable: false,
    order: 8,
    source: "core",
    governance: {
      anonymized: true,
    },
  },
];

export const getColumnLabel = (id: DeviceColumnId) =>
  DEVICE_COLUMNS.find((column) => column.id === id)?.label ?? id;
