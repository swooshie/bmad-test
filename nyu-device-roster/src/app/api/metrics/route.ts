'use server';

import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import { recordAuditLog } from "@/lib/audit/auditLogs";
import connectToDatabase from "@/lib/db";
import { logPerformanceMetric, logger } from "@/lib/logging";
import {
  aggregateSyncMetrics,
  type SyncAggregate,
  type SyncAggregateTotals,
} from "@/lib/metrics/syncAggregations";

const WEBHOOK_ENABLED = process.env.TELEMETRY_WEBHOOK_ENABLED === "true";
const WEBHOOK_URL = process.env.TELEMETRY_WEBHOOK_URL;
const WEBHOOK_CHANNEL = process.env.TELEMETRY_WEBHOOK_CHANNEL;

const MetricsSchema = z.object({
  metrics: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.number(),
        threshold: z.number().optional(),
        context: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        requestId: z.string().optional(),
        anonymized: z.boolean().optional(),
        timestamp: z.string().optional(),
      })
    )
    .min(1),
  requestId: z.string().optional(),
  anonymized: z.boolean().optional(),
});

export const POST = async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = MetricsSchema.safeParse(body);
  } catch (error) {
    logger.error({ event: "METRICS_PARSE_ERROR", error });
    return NextResponse.json(
      {
        data: null,
        error: { code: "INVALID_METRIC_PAYLOAD", message: "Metrics payload is invalid" },
      },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INVALID_METRIC_PAYLOAD",
          message: "Metrics payload is invalid",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const requestId = parsed.data.requestId ?? null;
  const anonymized = parsed.data.anonymized ?? false;

  parsed.data.metrics.forEach((metric) => {
    logPerformanceMetric({
      event: "PERFORMANCE_METRIC",
      metric: metric.metric,
      value: metric.value,
      threshold: metric.threshold ?? null,
      context: metric.context,
      requestId: metric.requestId ?? requestId,
      anonymized: metric.anonymized ?? anonymized,
      timestamp: metric.timestamp ?? new Date().toISOString(),
    });
  });

  return NextResponse.json({
    data: { recorded: true, count: parsed.data.metrics.length },
    error: null,
  });
};

export const GET = withSession(async (request: NextRequestWithSession) => {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const actorEmail = request.session.user?.email ?? null;
  const managerRole = request.session.user?.managerRole ?? null;

  if (managerRole !== "manager" && managerRole !== "lead") {
    await recordAuditLog({
      eventType: "governance",
      action: "METRICS_FETCH",
      actor: actorEmail,
      status: "error",
      errorCode: "FORBIDDEN",
      context: { requestId, managerRole },
    });

    return NextResponse.json(
      {
        data: null,
        error: { code: "FORBIDDEN", message: "Manager or lead access required" },
      },
      { status: 403 }
    );
  }

  try {
    await connectToDatabase();

    const last12h = await aggregateSyncMetrics(new Date(Date.now() - 12 * 60 * 60 * 1000));
    const cumulative = await aggregateSyncMetrics();

    const webhook = {
      enabled: WEBHOOK_ENABLED,
      configured: WEBHOOK_ENABLED && Boolean(WEBHOOK_URL),
      urlPresent: Boolean(WEBHOOK_URL),
      channel: WEBHOOK_CHANNEL ?? null,
      notes:
        "Set TELEMETRY_WEBHOOK_ENABLED=true with TELEMETRY_WEBHOOK_URL/TELEMETRY_WEBHOOK_CHANNEL to emit alerts; disabled by default as scaffold.",
    };

    await recordAuditLog({
      eventType: "governance",
      action: "METRICS_FETCH",
      actor: actorEmail,
      status: "success",
      context: { requestId, managerRole, windows: ["last12h", "cumulative"] },
    });

    logger.info(
      { event: "METRICS_FETCH", requestId, actor: actorEmail, managerRole },
      "Metrics endpoint served aggregates"
    );

    return NextResponse.json({
      data: {
        asOf: new Date().toISOString(),
        last12h,
        cumulative,
        webhook,
        schemaChange: cumulative.latestSchemaChange
          ? {
              detectedAt: cumulative.latestSchemaChange.detectedAt,
              added: cumulative.latestSchemaChange.added,
              removed: cumulative.latestSchemaChange.removed,
              renamed: cumulative.latestSchemaChange.renamed,
              currentVersion: cumulative.latestSchemaChange.currentVersion ?? null,
              previousVersion: cumulative.latestSchemaChange.previousVersion ?? null,
            }
          : null,
      },
      error: null,
    });
  } catch (error) {
    logger.error({ event: "METRICS_FETCH_FAILED", requestId, error }, "Failed to compute metrics");
    await recordAuditLog({
      eventType: "governance",
      action: "METRICS_FETCH",
      actor: actorEmail,
      status: "error",
      errorCode: "METRICS_FAILURE",
      context: { requestId },
    });

    return NextResponse.json(
      {
        data: null,
        error: { code: "METRICS_FAILURE", message: "Unable to compute telemetry." },
      },
      { status: 500 }
    );
  }
});
