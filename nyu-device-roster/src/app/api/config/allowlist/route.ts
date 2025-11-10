import { NextResponse } from "next/server";
import { z } from "zod";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import loadConfig, { upsertConfig, type AllowlistDiff } from "@/lib/config";
import { nyuEmailSchema } from "@/schemas/config";
import logger, { logAllowlistEndpointEvent } from "@/lib/logging";
import {
  recordAllowlistAccessDeniedEvent,
  recordAllowlistChangeEvent,
} from "@/lib/audit/syncEvents";

const allowlistUpdateSchema = z.object({
  emails: z.array(nyuEmailSchema).nonempty("At least one allowlisted email is required"),
});

type AllowlistResponse = {
  allowlist: string[];
  diff: AllowlistDiff;
  metadata: {
    lastUpdatedAt: string;
    updatedBy: string;
  };
};

const errorResponse = (options: {
  status: number;
  errorCode: string;
  message: string;
  details?: string;
}) =>
  NextResponse.json(
    {
      errorCode: options.errorCode,
      message: options.message,
      details: options.details,
    },
    { status: options.status }
  );

const extractRequestMeta = (request: NextRequestWithSession) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? undefined : undefined;

  return {
    route: request.nextUrl.pathname,
    method: request.method,
    requestId: request.headers.get("x-request-id") ?? undefined,
    ip,
  };
};

const buildAllowlistResponse = (config: Awaited<ReturnType<typeof loadConfig>>, diff: AllowlistDiff) =>
  ({
    allowlist: config?.allowlist ?? [],
    diff,
    metadata: {
      lastUpdatedAt: config?.lastUpdatedAt?.toISOString() ?? new Date(0).toISOString(),
      updatedBy: config?.updatedBy ?? "unknown",
    },
  }) satisfies AllowlistResponse;

const guardLeadRole = async (request: NextRequestWithSession) => {
  const { route, method, requestId, ip } = extractRequestMeta(request);
  const sessionUser = request.session.user;
  const userEmail = sessionUser?.email ?? null;
  const actorRole = sessionUser?.managerRole ?? null;

  if (actorRole === "lead") {
    return { allowed: true as const };
  }

  const reason = "LEAD_ROLE_REQUIRED";
  logAllowlistEndpointEvent({
    actorEmail: userEmail,
    actorRole,
    requestId,
    ip,
    outcome: "denied",
    reason,
  });

  await recordAllowlistAccessDeniedEvent({
    route,
    method,
    reason,
    userEmail,
    requestId,
    ip,
  });

  return {
    allowed: false as const,
    response: errorResponse({
      status: 403,
      errorCode: reason,
      message: "Lead manager role required",
      details: "managerRole=lead claim missing or not authorized for this operation",
    }),
  };
};

const getHandler = async (request: NextRequestWithSession) => {
  const guardResult = await guardLeadRole(request);
  if (!guardResult.allowed) {
    return guardResult.response;
  }

  const config = await loadConfig();
  if (!config) {
    logger.error(
      { event: "ALLOWLIST_CONFIG_MISSING", route: request.nextUrl.pathname },
      "Allowlist configuration is missing"
    );
    return errorResponse({
      status: 503,
      errorCode: "CONFIG_MISSING",
      message: "Configuration document not found",
      details: "Run the allowlist seeding workflow before calling this endpoint.",
    });
  }

  const response = buildAllowlistResponse(config, {
    added: [],
    removed: [],
    unchanged: config.allowlist,
  });

  const { requestId, ip } = extractRequestMeta(request);
  logAllowlistEndpointEvent({
    actorEmail: request.session.user?.email,
    actorRole: request.session.user?.managerRole,
    outcome: "granted",
    requestId,
    ip,
  });

  return NextResponse.json(response);
};

const putHandler = async (request: NextRequestWithSession) => {
  const guardResult = await guardLeadRole(request);
  if (!guardResult.allowed) {
    return guardResult.response;
  }

  const { requestId, ip, route, method } = extractRequestMeta(request);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse({
      status: 400,
      errorCode: "INVALID_JSON",
      message: "Request body must be valid JSON",
      details: "Submit payload as JSON with an `emails` array.",
    });
  }

  const parsed = allowlistUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse({
      status: 400,
      errorCode: "INVALID_ALLOWLIST",
      message: "Invalid allowlist payload",
      details: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  const currentConfig = await loadConfig();
  if (!currentConfig) {
    logger.error(
      { event: "ALLOWLIST_CONFIG_MISSING", route },
      "Allowlist configuration is missing"
    );
    return errorResponse({
      status: 503,
      errorCode: "CONFIG_MISSING",
      message: "Configuration document not found",
      details: "Seed configuration before attempting to update the allowlist.",
    });
  }

  const uniqueEmails = Array.from(new Set(parsed.data.emails)).sort();
  const operatorId = request.session.user?.email ?? "unknown";

  try {
    const result = await upsertConfig({
      allowlist: uniqueEmails,
      devicesSheetId: currentConfig.devicesSheetId,
      collectionName: currentConfig.collectionName,
      operatorId,
      source: "admin-endpoint",
    });

    const responseBody = buildAllowlistResponse(result.config, result.diff);

    logAllowlistEndpointEvent({
      actorEmail: operatorId,
      actorRole: request.session.user?.managerRole,
      outcome: "granted",
      requestId,
      ip,
      diff: result.diff,
    });

    await recordAllowlistChangeEvent({
      route,
      method,
      diff: result.diff,
      userEmail: operatorId,
      requestId,
      ip,
    });

    return NextResponse.json(responseBody);
  } catch (error) {
    logger.error(
      { event: "ALLOWLIST_UPDATE_FAILED", error, operatorId, route },
      "Failed to update allowlist"
    );
    return errorResponse({
      status: 500,
      errorCode: "ALLOWLIST_UPDATE_FAILED",
      message: "Unable to persist allowlist changes",
      details: "Check server logs for more details.",
    });
  }
};

export const GET = withSession((request) => getHandler(request));
export const PUT = withSession((request) => putHandler(request));
