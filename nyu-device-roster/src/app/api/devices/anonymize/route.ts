import { NextResponse } from "next/server";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import { logAnonymizationToggle } from "@/lib/logging";
import {
  ANONYMIZATION_COOKIE,
  buildAnonymizationCookie,
  readAnonymizationCookie,
} from "@/lib/anonymization";
import { recordAnonymizationToggleEvent } from "@/lib/audit/syncEvents";

type RequestBody = {
  enabled?: boolean;
};

export const POST = withSession(async (request: NextRequestWithSession) => {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    // default to empty body
  }

  const enabled = Boolean(body.enabled);
  const cookie = buildAnonymizationCookie(enabled);

  logAnonymizationToggle({
    enabled,
    userEmail: request.session.user?.email ?? null,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });

  await recordAnonymizationToggleEvent({
    route: "/api/devices/anonymize",
    method: "POST",
    enabled,
    userEmail: request.session.user?.email ?? null,
    requestId: request.headers.get("x-request-id") ?? undefined,
    ip: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? undefined,
  });

  const response = NextResponse.json(
    {
      data: { enabled, updatedAt: new Date().toISOString() },
      error: null,
    },
    { status: 200 }
  );
  response.cookies.set(cookie);
  return response;
});

export const GET = withSession(async (request: NextRequestWithSession) => {
  const enabled = readAnonymizationCookie(request.cookies);
  return NextResponse.json(
    {
      data: { enabled },
      error: null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
});
