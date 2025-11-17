import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";

export const ANONYMIZATION_COOKIE = "nyu-device-roster-anonymized";

const PLACEHOLDER_PREFIX = "Anon";

const hashSeed = (deviceId: string, field: string) => {
  const input = `${deviceId}:${field}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const buildPlaceholder = (deviceId: string, field: string) =>
  `${PLACEHOLDER_PREFIX}-${hashSeed(deviceId, field).slice(0, 6).toUpperCase()}`;

const maskValue = (deviceId: string, field: string, value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  return buildPlaceholder(deviceId, field);
};

export const anonymizeDeviceRow = (
  device: DeviceGridDevice,
  enabled: boolean
): DeviceGridDevice => {
  if (!enabled) {
    return device;
  }

  return {
    ...device,
    assignedTo: maskValue(device.deviceId, "assignedTo", device.assignedTo) ?? "—",
    sheetId: maskValue(device.deviceId, "sheetId", device.sheetId) ?? "—",
    lastTransferNotes:
      maskValue(device.deviceId, "lastTransferNotes", device.lastTransferNotes ?? null) ?? null,
  };
};

export const readAnonymizationCookie = (
  cookies?:
    | { get?: (key: string) => { value?: string } | string | undefined }
    | Record<string, string | { value?: string } | undefined>
): boolean => {
  if (!cookies) return false;
  const getter = (cookies as { get?: (key: string) => unknown }).get;
  let cookieValue: string | undefined;

  if (typeof getter === "function") {
    const result = getter.call(cookies, ANONYMIZATION_COOKIE) as { value?: string } | string | undefined;
    cookieValue = typeof result === "string" ? result : result?.value;
  } else if (ANONYMIZATION_COOKIE in cookies) {
    const raw = (cookies as Record<string, string | { value?: string } | undefined>)[ANONYMIZATION_COOKIE];
    cookieValue = typeof raw === "string" ? raw : raw?.value;
  }

  return cookieValue === "1" || cookieValue === "true";
};

export const buildAnonymizationCookie = (enabled: boolean) => ({
  name: ANONYMIZATION_COOKIE,
  value: enabled ? "1" : "0",
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, // one week
});

export const __private__ = {
  hashSeed,
  buildPlaceholder,
};
