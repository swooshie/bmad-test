import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  logAuthAlert,
  logAuthFailure,
  logAuthSuccess,
  type AuthFailureLog,
} from "@/lib/logging";

export type NextRequestWithSession = NextRequest & { session: Session };
export type SessionRouteHandler<TContext = unknown> = (
  request: NextRequestWithSession,
  context: TContext
) => Promise<Response> | Response;

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;

type FailureTrackerEntry = {
  count: number;
  firstFailure: number;
};

const failureTracker = new Map<string, FailureTrackerEntry>();

const getClientIp = (request: NextRequest): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
};

const normalizeFailureKey = (ip: string) => ip ?? "unknown";

const trackFailure = (payload: AuthFailureLog) => {
  const key = normalizeFailureKey(payload.ip ?? "unknown");
  const now = Date.now();
  const existing = failureTracker.get(key);

  if (!existing || now - existing.firstFailure > FAILURE_WINDOW_MS) {
    failureTracker.set(key, {
      count: 1,
      firstFailure: now,
    });
    logAuthFailure(payload);
    return;
  }

  existing.count += 1;
  if (existing.count >= FAILURE_THRESHOLD) {
    logAuthAlert({ ...payload, count: existing.count });
    existing.count = 0;
    existing.firstFailure = now;
    return;
  }

  logAuthFailure(payload);
};

export const withSession =
  <TContext = unknown>(handler: SessionRouteHandler<TContext>) =>
  async (request: NextRequest, context: TContext) => {
    const session = await getServerSession(authOptions);
    const route = request.nextUrl.pathname;
    const method = request.method;
    const ip = getClientIp(request);
    const requestId = request.headers.get("x-request-id") ?? undefined;

    if (!session) {
      trackFailure({
        event: "AUTH_INVALID_SESSION",
        route,
        method,
        reason: "SESSION_MISSING",
        requestId,
        ip,
      });
      return NextResponse.json(
        { error: "Unauthorized", reason: "SESSION_MISSING" },
        { status: 401 }
      );
    }

    if (!session.user) {
      trackFailure({
        event: "AUTH_INVALID_SESSION",
        route,
        method,
        reason: "USER_MISSING",
        requestId,
        ip,
      });
      return NextResponse.json(
        { error: "Unauthorized", reason: "USER_MISSING" },
        { status: 401 }
      );
    }

    logAuthSuccess({
      route,
      method,
      userEmail: session.user.email ?? null,
    });

    (request as NextRequestWithSession).session = session;

    return handler(request as NextRequestWithSession, context);
  };

export const __resetFailureTrackerForTests = () => {
  failureTracker.clear();
};
