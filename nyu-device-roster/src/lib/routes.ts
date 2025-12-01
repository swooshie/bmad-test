export const API_ROUTES = {
  devices: "/api/devices",
  deviceDetail: (serial: string) => `/api/devices/${encodeURIComponent(serial)}`,
  deviceExport: "/api/devices/export",
  deviceColumns: "/api/devices/columns",
  deviceDrawerExport: "/api/devices/actions/export",
  deviceDrawerHandoff: "/api/devices/actions/handoff",
  deviceAnonymize: "/api/devices/anonymize",
  devicePresets: "/api/devices/presets",
  auditEvents: (filters?: { serial?: string; eventTypes?: string[] }) => {
    const params = new URLSearchParams();
    if (filters?.serial) {
      params.set("serial", filters.serial);
    }
    for (const eventType of filters?.eventTypes ?? []) {
      params.append("eventType", eventType);
    }
    const suffix = params.toString();
    return suffix ? `/api/audit?${suffix}` : "/api/audit";
  },
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
