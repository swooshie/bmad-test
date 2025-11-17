"use client";

import { API_ROUTES } from "@/lib/routes";
import { logDeviceDrawerAction } from "@/lib/logging";

type DrawerActionResult = { success: true } | { success: false; message: string };

export const exportAuditSnapshot = async (deviceId: string): Promise<DrawerActionResult> => {
  try {
    const response = await fetch(API_ROUTES.deviceDrawerExport, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    const payload = (await response.json()) as {
      data?: { url: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.data?.url) {
      throw new Error(payload.error?.message ?? "Export failed");
    }
    logDeviceDrawerAction({
      event: "DEVICE_DRAWER_ACTION",
      action: "EXPORT_AUDIT_SNAPSHOT",
      deviceId,
      outcome: "success",
    });
    return { success: true };
  } catch (error) {
    logDeviceDrawerAction({
      event: "DEVICE_DRAWER_ACTION",
      action: "EXPORT_AUDIT_SNAPSHOT",
      deviceId,
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: error instanceof Error ? error.message : "Export failed" };
  }
};

export const initiateHandoff = async (deviceId: string): Promise<DrawerActionResult> => {
  try {
    const response = await fetch(API_ROUTES.deviceDrawerHandoff, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    const payload = (await response.json()) as {
      data?: { status: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.data) {
      throw new Error(payload.error?.message ?? "Handoff failed");
    }
    logDeviceDrawerAction({
      event: "DEVICE_DRAWER_ACTION",
      action: "HANDOFF_INITIATED",
      deviceId,
      outcome: "success",
    });
    return { success: true };
  } catch (error) {
    logDeviceDrawerAction({
      event: "DEVICE_DRAWER_ACTION",
      action: "HANDOFF_INITIATED",
      deviceId,
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: error instanceof Error ? error.message : "Handoff failed" };
  }
};
