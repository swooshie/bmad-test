import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import { logger } from "@/lib/logging";
import { recordSyncEvent } from "@/lib/audit/deviceDrawerEvents";

type HandoffResponse =
  | { data: { status: "queued" }; error: null }
  | { data: null; error: { code: string; message: string } };

export const POST = withSession(async (request) => {
  const body = (await request.json().catch(() => ({}))) as { deviceId?: string | null };
  const deviceId = body.deviceId;

  if (!deviceId) {
    return NextResponse.json<HandoffResponse>(
      { data: null, error: { code: "DEVICE_ID_REQUIRED", message: "deviceId is required" } },
      { status: 400 }
    );
  }

  logger.info(
    {
      event: "DEVICE_DRAWER_ACTION",
      action: "HANDOFF_INITIATED",
      deviceId,
      userEmail: request.session.user?.email ?? null,
    },
    "Device handoff initiated"
  );

  await recordSyncEvent({
    deviceId,
    eventType: "DEVICE_HANDOFF_INITIATED",
    route: "/api/devices/actions/handoff",
    method: "POST",
    actor: request.session.user?.email ?? null,
  });

  return NextResponse.json<HandoffResponse>({ data: { status: "queued" }, error: null }, { status: 200 });
});
