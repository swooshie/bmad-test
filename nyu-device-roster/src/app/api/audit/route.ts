import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import connectToDatabase from "@/lib/db";
import SyncEventModel, { type SyncEventType } from "@/models/SyncEvent";
import logger from "@/lib/logging";

type AuditEvent = {
  id: string;
  eventType: SyncEventType;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type AuditResponse =
  | { data: { events: AuditEvent[] }; error: null }
  | { data: null; error: { code: string; message: string } };

export const GET = withSession(async (request) => {
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json<AuditResponse>(
      {
        data: null,
        error: { code: "DEVICE_ID_REQUIRED", message: "deviceId is required" },
      },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const events = await SyncEventModel.find({
      "metadata.deviceId": deviceId,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    return NextResponse.json<AuditResponse>({
      data: {
        events: events.map((event) => ({
          id: event._id.toString(),
          eventType: event.eventType,
          summary: event.reason ?? event.eventType,
          createdAt: event.createdAt.toISOString(),
          metadata: event.metadata ?? {},
        })),
      },
      error: null,
    });
  } catch (error) {
    logger.error(
      {
        event: "AUDIT_TIMELINE_FETCH_FAILED",
        deviceId,
        err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      },
      "Failed to load audit timeline"
    );
    return NextResponse.json<AuditResponse>(
      {
        data: null,
        error: { code: "AUDIT_TIMELINE_FETCH_FAILED", message: "Unable to load audit timeline" },
      },
      { status: 500 }
    );
  }
});
