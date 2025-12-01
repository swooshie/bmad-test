import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import connectToDatabase from "@/lib/db";
import logger from "@/lib/logging";
import AuditLogModel, {
  type AuditEventType,
  type AuditStatus,
} from "@/models/AuditLog";

type AuditEvent = {
  id: string;
  eventType: AuditEventType;
  action: string;
  status: AuditStatus;
  actor: string | null;
  errorCode?: string | null;
  timestamp: string;
  context?: Record<string, unknown>;
};

type AuditResponse =
  | { data: { events: AuditEvent[] }; error: null }
  | { data: null; error: { code: string; message: string } };

const parseEventTypes = (searchParams: URLSearchParams): AuditEventType[] => {
  const allowed: AuditEventType[] = [
    "sync",
    "anonymization",
    "allowlist-change",
    "governance",
    "accessibility",
  ];
  const raw = searchParams
    .getAll("eventType")
    .flatMap((value) => value.split(",").map((v) => v.trim()).filter(Boolean))
    .filter((value): value is AuditEventType => allowed.includes(value as AuditEventType));
  const unique = Array.from(new Set(raw));
  return unique.length ? unique : allowed;
};

export const GET = withSession(async (request) => {
  const eventTypes = parseEventTypes(request.nextUrl.searchParams);
  const identifier =
    request.nextUrl.searchParams.get("serial") ??
    request.nextUrl.searchParams.get("deviceId") ??
    undefined;

  try {
    await connectToDatabase();
    const query: Record<string, unknown> = { eventType: { $in: eventTypes } };
    if (identifier) {
      query.$or = [{ "context.serial": identifier }, { "context.deviceId": identifier }];
    }

    const events = await AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();

    const mapped: AuditEvent[] = events.map((event) => ({
      id: event._id.toString(),
      eventType: event.eventType,
      action: event.action,
      status: event.status,
      actor: event.actor ?? null,
      errorCode: event.errorCode ?? null,
      timestamp: event.createdAt.toISOString(),
      context: event.context ?? undefined,
    }));

    logger.info(
      {
        event: "AUDIT_FEED_REQUESTED",
        actor: request.session.user?.email ?? null,
        filters: eventTypes,
        serial: identifier ?? null,
      },
      "Audit feed fetched"
    );

    return NextResponse.json<AuditResponse>({
      data: { events: mapped },
      error: null,
    });
  } catch (error) {
    logger.error(
      {
        event: "AUDIT_FEED_FETCH_FAILED",
        filters: eventTypes,
        serial: identifier ?? null,
        err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      },
      "Failed to load audit feed"
    );
    return NextResponse.json<AuditResponse>(
      {
        data: null,
        error: { code: "AUDIT_FEED_FETCH_FAILED", message: "Unable to load audit events" },
      },
      { status: 500 }
    );
  }
});
