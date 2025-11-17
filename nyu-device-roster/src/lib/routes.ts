export const API_ROUTES = {
  devices: "/api/devices",
  deviceDetail: (deviceId: string) => `/api/devices/${encodeURIComponent(deviceId)}`,
  deviceExport: "/api/devices/export",
  deviceDrawerExport: "/api/devices/actions/export",
  deviceDrawerHandoff: "/api/devices/actions/handoff",
  deviceAnonymize: "/api/devices/anonymize",
  devicePresets: "/api/devices/presets",
  auditEvents: (deviceId: string) => `/api/audit?deviceId=${encodeURIComponent(deviceId)}`,
  metrics: "/api/metrics",
  session: "/api/session",
  syncManual: "/api/sync/manual",
  iconActionAudit: "/api/audit/icon-action",
} as const;

export const MANAGER_ROUTES = {
  dashboard: "/dashboard",
  devices: "/devices",
} as const;

export type ManagerRouteKey = keyof typeof MANAGER_ROUTES;

export const resolveManagerRoute = (key: ManagerRouteKey) => MANAGER_ROUTES[key];
