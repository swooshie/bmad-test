export type DeviceColumnId =
  | "deviceId"
  | "assignedTo"
  | "status"
  | "condition"
  | "offboardingStatus"
  | "lastSeen"
  | "lastSyncedAt"
  | "sheetId";

export type DeviceColumn = {
  id: DeviceColumnId;
  label: string;
  description?: string;
  numeric?: boolean;
  minWidth?: number;
  visible?: boolean;
};

export const DEVICE_COLUMNS: DeviceColumn[] = [
  {
    id: "deviceId",
    label: "Device ID",
    description: "Unique roster identifier",
    minWidth: 160,
    visible: true,
  },
  {
    id: "assignedTo",
    label: "Assigned To",
    description: "Current owner",
    minWidth: 160,
    visible: true,
  },
  {
    id: "status",
    label: "Status",
    description: "Roster status",
    minWidth: 120,
    visible: true,
  },
  {
    id: "condition",
    label: "Condition",
    description: "Hardware condition",
    minWidth: 140,
    visible: true,
  },
  {
    id: "offboardingStatus",
    label: "Offboarding",
    description: "Offboarding tracker",
    minWidth: 140,
    visible: true,
  },
  {
    id: "lastSeen",
    label: "Last Seen",
    description: "Last device signal",
    minWidth: 150,
    visible: true,
  },
  {
    id: "lastSyncedAt",
    label: "Last Synced",
    description: "Last sheet ingest timestamp",
    minWidth: 170,
    visible: true,
  },
  {
    id: "sheetId",
    label: "Sheet ID",
    description: "Source sheet",
    minWidth: 120,
    visible: false,
  },
];

export const getColumnLabel = (id: DeviceColumnId) =>
  DEVICE_COLUMNS.find((column) => column.id === id)?.label ?? id;
