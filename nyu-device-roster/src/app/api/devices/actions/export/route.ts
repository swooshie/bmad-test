import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import { logger } from "@/lib/logging";
import { recordSyncEvent } from "@/lib/audit/deviceDrawerEvents";

type ExportResponse =
  | { data: { url: string }; error: null }
  | { data: null; error: { code: string; message: string } };

export const POST = withSession(async (request) => {
  const body = (await request.json().catch(() => ({}))) as { serial?: string | null };
  const serial = body.serial;

  if (!serial) {
    return NextResponse.json<ExportResponse>(
      { data: null, error: { code: "DEVICE_ID_REQUIRED", message: "serial is required" } },
      { status: 400 }
    );
  }

  const url = `/api/devices/export?serial=${encodeURIComponent(serial)}`;

  logger.info(
    {
      event: "DEVICE_DRAWER_ACTION",
      action: "EXPORT_AUDIT_SNAPSHOT",
      serial,
      userEmail: request.session.user?.email ?? null,
    },
    "Device drawer export triggered"
  );
  await recordSyncEvent({
    serial,
    eventType: "DEVICE_AUDIT_EXPORT",
    route: "/api/devices/actions/export",
    method: "POST",
    actor: request.session.user?.email ?? null,
  });

  return NextResponse.json<ExportResponse>({ data: { url }, error: null }, { status: 200 });
});
